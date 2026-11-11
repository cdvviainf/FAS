import { Prisma } from '@prisma/client'
import { prisma } from '../../../lib/prisma.js'
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../../shared/errors.js'
import { temporadaParaCrear } from '../../../shared/temporada-documento.js'
import { descripcionComercialArticulo } from '../../../shared/articulo-descripcion.js'
import * as repo from './solicitudes-pago.repository.js'
import { calcularGrupo, claveCuota, type CuotaOc, type FechaReferencia, type LineaPalletDespachada } from './solicitudes-pago.calculo.js'
import type { ConfirmarPagoBody, PendientesQuery, SolicitudCreateBody, SolicitudesListQuery, SolicitudUpdateBody } from './solicitudes-pago.schema.js'

type Tx = Prisma.TransactionClient
const round2 = (n: number) => Math.round(n * 100) / 100
const TX_OPTS = { timeout: 30_000, maxWait: 10_000 }

// ─── Lo despachado por OC × Embarque, con sus cuotas y saldos ────────────────

export async function calcularDespachado(f: repo.FiltrosDespachado & { excluirSolicitudId?: number }, db: Tx | typeof prisma = prisma) {
  const pallets = await repo.getPalletsDespachados(f, db)
  const ocIds = [...new Set(pallets.map((p) => p.recepcion.ordenCompraId).filter((x): x is number => x != null))]
  const [ordenes, solicitado] = await Promise.all([
    repo.getOrdenesParaPago(ocIds, db),
    repo.getSolicitadoPorCuota(ocIds, f.excluirSolicitudId ?? null, db),
  ])
  const ocPorId = new Map(ordenes.map((o) => [o.id, o]))
  const solicitadoPorClave = new Map(
    solicitado.map((s) => [claveCuota(s.ordenCompraId, s.embarqueId, s.ordenCompraCuotaPagoId), Number(s._sum.montoSolicitado ?? 0)]),
  )

  // Agrupa líneas de pallet por (OC, Embarque).
  type Grupo = { ocId: number; embarque: (typeof pallets)[number]['embarque']; lineas: LineaPalletDespachada[]; pallets: Set<number> }
  const grupos = new Map<string, Grupo>()
  for (const p of pallets) {
    const ocId = p.recepcion.ordenCompraId
    if (ocId == null || !ocPorId.has(ocId)) continue
    const k = `${ocId}|${p.embarque!.id}`
    let g = grupos.get(k)
    if (!g) {
      g = { ocId, embarque: p.embarque, lineas: [], pallets: new Set() }
      grupos.set(k, g)
    }
    g.pallets.add(p.id)
    for (const l of p.lineas) {
      g.lineas.push({
        palletId: p.id,
        numeroPallet: p.numeroPallet,
        especieId: l.especieId,
        variedadId: l.variedadId,
        categoriaId: l.categoriaId,
        articuloId: l.articuloId,
        etiquetaId: l.etiquetaId,
        calibreId: l.calibreId,
        cajas: l.cajas,
        kgNetoEnvase: l.articulo.kgNetoEnvase != null ? Number(l.articulo.kgNetoEnvase) : null,
        especie: l.especie.descripcion,
        variedad: l.variedad.descripcion,
        categoria: l.categoria.descripcion,
        calibre: l.calibre.descripcion,
        embalaje: descripcionComercialArticulo(l.articulo),
        etiqueta: l.etiqueta?.descripcion ?? null,
      })
    }
  }

  return [...grupos.values()].map((g) => {
    const oc = ocPorId.get(g.ocId)!
    const emb = g.embarque!
    const fechaZarpe = emb.reservaManual ? emb.fechaZarpeManual : (emb.solicitudReserva?.fechaZarpe ?? null)
    const cuotasOc: CuotaOc[] = oc.cuotasPago.map((c) => ({
      id: c.id,
      fechaReferencia: c.fechaReferencia as FechaReferencia,
      plazoDias: c.plazoDias,
      tipoValor: c.tipoValor,
      porcentaje: c.porcentaje != null ? Number(c.porcentaje) : null,
      valorUnitario: c.valorUnitario != null ? Number(c.valorUnitario) : null,
      unidadCodigo: c.unidad?.codigo ?? null,
      monedaId: c.monedaId,
      descripcion: c.descripcion,
    }))
    const r = calcularGrupo(
      g.lineas,
      oc.lineas.map((l) => ({
        id: l.id,
        especieId: l.especieId,
        variedadId: l.variedadId,
        categoriaId: l.categoriaId,
        articuloId: l.articuloId,
        etiquetaId: l.etiquetaId,
        calibreIds: l.calibres.map((c) => c.calibreId),
        precioUsdCaja: l.precioUsdCaja != null ? Number(l.precioUsdCaja) : null,
      })),
      cuotasOc,
      { monedaOcId: oc.monedaId, modalidad: oc.modalidad, fechaZarpe, fechaArribo: emb.fechaArribo },
    )
    const bloqueado = r.bloqueos.length > 0
    return {
      productor: oc.entidadProductor,
      ordenCompra: { id: oc.id, numero: oc.numero, moneda: oc.moneda, monedaId: oc.monedaId, condicionPago: oc.condicionPago },
      embarque: { id: emb.id, numeroInstructivo: emb.numeroInstructivo, fechaZarpe, fechaArribo: emb.fechaArribo },
      pallets: g.pallets.size,
      cajas: r.cajas,
      kilos: r.kilos,
      monto: r.monto,
      bloqueos: r.bloqueos,
      detalle: r.detalle,
      cuotas: r.cuotas.map((c) => {
        const ya = solicitadoPorClave.get(claveCuota(oc.id, emb.id, c.ordenCompraCuotaPagoId)) ?? 0
        return { ...c, solicitado: round2(ya), saldo: round2(Math.max(0, c.montoCalculado - ya)), bloqueada: bloqueado }
      }),
    }
  })
}

// Pendientes de pago: grupos con al menos una cuota con saldo (los bloqueados
// por precio pendiente también se listan, para que se vea por qué no se pagan).
export async function listarPendientes(f: PendientesQuery) {
  const grupos = await calcularDespachado({ entidadProductorId: f.entidadProductorId, temporadaId: f.temporadaId })
  return grupos
    .filter((g) => g.cuotas.some((c) => c.saldo > 0.005))
    .sort((a, b) => a.productor.razonSocial.localeCompare(b.productor.razonSocial) || a.ordenCompra.numero.localeCompare(b.ordenCompra.numero))
}

type GrupoDespachado = Awaited<ReturnType<typeof calcularDespachado>>[number]

// Revalida lo solicitado contra lo despachado recalculado (nunca confía en el
// cliente): cuota existente, sin precio pendiente, monto ≤ saldo, misma moneda.
function validarLineas(grupos: GrupoDespachado[], lineas: SolicitudCreateBody['lineas']) {
  const porClave = new Map<string, { grupo: GrupoDespachado; cuota: GrupoDespachado['cuotas'][number] }>()
  for (const g of grupos) for (const c of g.cuotas) porClave.set(claveCuota(g.ordenCompra.id, g.embarque.id, c.ordenCompraCuotaPagoId), { grupo: g, cuota: c })

  const monedas = new Set<number>()
  const persistir: repo.LineaPersistir[] = lineas.map((l) => {
    const hit = porClave.get(claveCuota(l.ordenCompraId, l.embarqueId, l.ordenCompraCuotaPagoId))
    if (!hit) {
      throw new ValidationError('Una de las cuotas no corresponde a lo despachado del productor en OC de la temporada de la solicitud — recarga e intenta de nuevo')
    }
    const { grupo, cuota } = hit
    const ref = `${grupo.ordenCompra.numero} / Embarque ${grupo.embarque.numeroInstructivo} / cuota ${cuota.numeroCuota}`
    if (cuota.bloqueada) throw new ValidationError(`${ref}: ${grupo.bloqueos.join(' · ')}`)
    const monto = round2(l.montoSolicitado)
    if (monto > cuota.saldo + 0.005) {
      throw new ValidationError(`${ref}: el monto solicitado (${monto}) supera el saldo de la cuota (${cuota.saldo})`)
    }
    monedas.add(grupo.ordenCompra.monedaId)
    return {
      ordenCompraId: l.ordenCompraId,
      embarqueId: l.embarqueId,
      ordenCompraCuotaPagoId: l.ordenCompraCuotaPagoId,
      numeroCuota: cuota.numeroCuota,
      fechaVencimiento: cuota.fechaVencimiento,
      montoCalculado: cuota.montoCalculado,
      montoSolicitado: monto,
    }
  })
  if (monedas.size > 1) throw new ValidationError('Las cuotas seleccionadas son de OC en monedas distintas: haz una solicitud por moneda')
  const montoTotal = round2(persistir.reduce((a, l) => a + l.montoSolicitado, 0))
  return { persistir, monedaId: [...monedas][0], montoTotal }
}

export async function listarSolicitudes(q: SolicitudesListQuery) {
  const { data, total } = await repo.listSolicitudes(q)
  return { data, meta: { total, page: q.page, limit: q.limit, totalPages: Math.ceil(total / q.limit) } }
}

export async function obtenerSolicitud(id: number) {
  const s = await repo.getSolicitudById(id)
  if (!s) throw new NotFoundError('Solicitud de Pago', String(id))
  return s
}

export async function crearSolicitud(body: SolicitudCreateBody, userId: string) {
  const productor = await repo.getProductor(body.entidadProductorId)
  if (!productor) throw new ValidationError('El productor no existe o no es de tipo Productor')
  const temporadaId = await temporadaParaCrear(body.temporadaId, new Date())

  return prisma.$transaction(async (tx) => {
    await repo.lockProductor(tx, body.entidadProductorId)
    // Solo OC de la temporada de la solicitud (= temporada activa, decisión del usuario).
    const grupos = await calcularDespachado({ entidadProductorId: body.entidadProductorId, temporadaId }, tx)
    const { persistir, monedaId, montoTotal } = validarLineas(grupos, body.lineas)
    const numero = await repo.siguienteNumero(tx)
    return repo.crearSolicitud(
      tx,
      {
        numero,
        temporadaId,
        entidadProductorId: body.entidadProductorId,
        monedaId,
        observaciones: body.observaciones?.trim() || null,
        montoTotal,
        lineas: persistir,
      },
      userId,
    )
  }, TX_OPTS)
}

export async function actualizarSolicitud(id: number, body: SolicitudUpdateBody, userId: string) {
  const actual = await obtenerSolicitud(id)
  if (actual.estado !== 'SOLICITADA') throw new ConflictError('Solo se puede editar una solicitud en estado Solicitada')

  return prisma.$transaction(async (tx) => {
    await repo.lockProductor(tx, actual.entidadProductorId)
    const grupos = await calcularDespachado(
      { entidadProductorId: actual.entidadProductorId, temporadaId: actual.temporadaId, excluirSolicitudId: id },
      tx,
    )
    const { persistir, monedaId, montoTotal } = validarLineas(grupos, body.lineas)
    if (monedaId !== actual.monedaId) throw new ValidationError('No se puede cambiar la moneda de la solicitud')
    const r = await repo.reemplazarLineas(
      tx,
      id,
      { observaciones: body.observaciones !== undefined ? body.observaciones?.trim() || null : actual.observaciones, montoTotal, lineas: persistir },
      userId,
    )
    if (!r) throw new ConflictError('La solicitud cambió de estado mientras la editabas — recarga e intenta de nuevo')
    return r
  }, TX_OPTS)
}

// "Confirmar pago" (permiso PROD_SOLICITUD_PAGO_CONFIRMAR): registra fecha de
// pago, N° de factura del productor por cuota y genera un DEBE por cuota en su
// cuenta corriente (saldo = ΣHABER − ΣDEBE: el pago reduce lo que se le debe).
export async function confirmarPago(id: number, body: ConfirmarPagoBody, userId: string) {
  const previa = await obtenerSolicitud(id)
  return prisma.$transaction(async (tx) => {
    await repo.lockProductor(tx, previa.entidadProductorId)
    const s = await repo.getSolicitudTx(tx, id)
    if (!s) throw new NotFoundError('Solicitud de Pago', String(id))
    if (s.estado !== 'SOLICITADA') throw new ConflictError('Solo se puede confirmar el pago de una solicitud en estado Solicitada')

    const facturaPorLinea = new Map(body.facturas.map((f) => [f.lineaId, f.numeroFactura.trim()]))
    if (facturaPorLinea.size !== body.facturas.length || s.lineas.some((l) => !facturaPorLinea.get(l.id)) || facturaPorLinea.size !== s.lineas.length) {
      throw new ValidationError('Indica el N° de factura del productor para cada cuota de la solicitud')
    }

    const concepto = await repo.lockConcepto(tx, body.conceptoCtaCteId)
    if (!concepto || concepto.eliminadoEn != null || concepto.bloqueado) {
      throw new ValidationError('El concepto de cuenta corriente no existe, está bloqueado o fue eliminado')
    }
    if (concepto.naturaleza === 'HABER') {
      throw new ValidationError('El concepto de cuenta corriente es de naturaleza HABER; el pago al productor requiere DEBE o AMBOS (R6)')
    }

    const fechaPago = new Date(body.fechaPago)
    const ok = await repo.marcarPagada(
      tx,
      id,
      { fechaPago, conceptoCtaCteId: body.conceptoCtaCteId, numeroTransferencia: body.numeroTransferencia?.trim() || null },
      userId,
    )
    if (!ok) throw new ConflictError('La solicitud cambió de estado — recarga e intenta de nuevo')

    for (const l of s.lineas) {
      const nf = facturaPorLinea.get(l.id)!
      const mov = await repo.crearMovimientoCc(
        tx,
        {
          entidadId: s.entidadProductorId,
          tipoId: body.conceptoCtaCteId,
          naturaleza: 'DEBE',
          fecha: fechaPago,
          glosa: `Pago factura N° ${nf} — ${s.numero}`,
          monto: l.montoSolicitado,
          monedaId: s.monedaId,
          referencia: s.numero,
          temporadaId: s.temporadaId,
        },
        userId,
      )
      await repo.actualizarLineaPago(tx, l.id, { numeroFactura: nf, movimientoCcId: mov.id })
    }
    return (await repo.getSolicitudTx(tx, id))!
  }, TX_OPTS)
}

// Anular. Solicitada → Anulada (libera el saldo de las cuotas). Pagada → exige
// el permiso de confirmar pago y revierte cada DEBE con un contramovimiento
// HABER del mismo concepto (R5: movimientos inmutables, corrección por reverso).
export async function anularSolicitud(id: number, userId: string, puedeConfirmar: boolean) {
  const previa = await obtenerSolicitud(id)
  return prisma.$transaction(async (tx) => {
    await repo.lockProductor(tx, previa.entidadProductorId)
    const s = await repo.getSolicitudTx(tx, id)
    if (!s) throw new NotFoundError('Solicitud de Pago', String(id))
    if (s.estado === 'ANULADA') throw new ConflictError('La solicitud ya está anulada')
    if (s.estado === 'PAGADA' && !puedeConfirmar) {
      throw new ForbiddenError('Anular una solicitud pagada requiere el permiso de confirmar pagos')
    }
    const estadoPrevio = s.estado
    if (!(await repo.marcarAnulada(tx, id, estadoPrevio, userId))) {
      throw new ConflictError('La solicitud cambió de estado — recarga e intenta de nuevo')
    }
    if (estadoPrevio === 'PAGADA') {
      const hoy = new Date()
      for (const l of s.lineas) {
        if (l.movimientoCcId == null || l.movimientoAnulacionCcId != null) continue
        const mov = await repo.crearMovimientoCc(
          tx,
          {
            entidadId: s.entidadProductorId,
            tipoId: s.conceptoCtaCteId!,
            naturaleza: 'HABER',
            fecha: hoy,
            glosa: `Anula pago factura N° ${l.numeroFactura ?? '—'} — ${s.numero}`,
            monto: l.montoSolicitado,
            monedaId: s.monedaId,
            referencia: s.numero,
            temporadaId: s.temporadaId,
          },
          userId,
        )
        await repo.actualizarLineaPago(tx, l.id, { movimientoAnulacionCcId: mov.id })
      }
    }
    return (await repo.getSolicitudTx(tx, id))!
  }, TX_OPTS)
}
