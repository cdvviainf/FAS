import { Prisma } from '@prisma/client'
import type { EstadoCobranza } from '@prisma/client'
import { prisma } from '../../../lib/prisma.js'
import { getEmpresaIdActual } from '../../../lib/empresa-context.js'
import { ValidationError } from '../../../shared/errors.js'
import { LOCK_NAMESPACE_COBRANZA_PAGO } from '../../../shared/advisory-locks.js'
import { esFacturaTimbrada } from './sii-estado.js'
import {
  derivarEstadoCobranza,
  distribuirEnCuotas,
  inicioDeHoy,
  planRefresco,
  sumarMontos,
  type FechasBase,
} from './cobranza-estado.js'
import type { CrearPagoInput, PagoAplicacionInput, PagosListFilters, TipoFacturaCobranza } from './pago.types.js'

const round2 = (n: number) => Math.round(n * 100) / 100

// Tolerancia de redondeo al comparar montos derivados (conversión de moneda):
// medio centavo, por debajo de la escala Decimal(14,2).
const EPSILON = 0.005

// Prisma Client Transaction type (el tx que recibe $transaction).
type Tx = Prisma.TransactionClient

export interface CuotaCartera {
  id: number
  numeroCuota: number
  montoCuota: number
  saldoPendiente: number
  montoPagado: number
  fechaVencimiento: Date | null
}

export interface FacturaCartera {
  tipoFactura: TipoFacturaCobranza
  id: number
  codigo: string
  clienteId: number
  monedaId: number
  estadoSii: string
  cuotas: CuotaCartera[]
}

const mapCuota = (c: {
  id: number
  numeroCuota: number
  montoCuota: Prisma.Decimal
  saldoPendiente: Prisma.Decimal
  montoPagado: Prisma.Decimal
  fechaVencimiento: Date | null
}): CuotaCartera => ({
  id: c.id,
  numeroCuota: c.numeroCuota,
  montoCuota: Number(c.montoCuota),
  saldoPendiente: Number(c.saldoPendiente),
  montoPagado: Number(c.montoPagado),
  fechaVencimiento: c.fechaVencimiento,
})

// ─── Lecturas de apoyo ──────────────────────────────────────────────────────
export async function getClienteCobranza(clienteId: number) {
  return prisma.entidad.findFirst({
    where: { id: clienteId, eliminadoEn: null },
    select: { id: true, codigo: true, descripcion: true, razonSocial: true, tipos: true },
  })
}

export async function getMonedaById(monedaId: number) {
  return prisma.moneda.findFirst({
    where: { id: monedaId, eliminadoEn: null },
    select: { id: true, codigo: true, descripcion: true },
  })
}

// Opciones de clientes para la pantalla de Cobranza (FAS-COB-PAG-R1-003): se
// expone acá, bajo VENTAS_COBRANZA, para no exigirle al usuario de Cobranza el
// permiso CONFIG_ENTIDADES del mantenedor. Solo entidades cliente (nac/ext).
export async function listClientesCobranza() {
  const data = await prisma.entidad.findMany({
    where: {
      eliminadoEn: null,
      activo: true,
      tipos: { hasSome: ['CLIENTE_NACIONAL', 'CLIENTE_EXTRANJERO'] },
    },
    select: { id: true, codigo: true, descripcion: true, razonSocial: true },
    orderBy: { descripcion: 'asc' },
  })
  return data
}

// Opciones de monedas para la pantalla de Cobranza (mismo criterio que clientes:
// bajo VENTAS_COBRANZA, no CONFIG_MONEDAS).
export async function listMonedasCobranza() {
  return prisma.moneda.findMany({
    where: { eliminadoEn: null },
    select: { id: true, codigo: true, descripcion: true },
    orderBy: { codigo: 'asc' },
  })
}

const cuotaSelect = {
  id: true,
  numeroCuota: true,
  fechaReferencia: true,
  plazoDias: true,
  montoCuota: true,
  saldoPendiente: true,
  montoPagado: true,
  fechaVencimiento: true,
  estado: true,
} as const

// Facturas (Exportación + Nacional) del cliente con saldo pendiente en cartera,
// para armar la pantalla de aplicación de pago. Filtra por estadoCobranza activo
// y, opcionalmente, por moneda.
const ESTADOS_CARTERA_ACTIVOS: EstadoCobranza[] = ['PENDIENTE', 'PARCIAL', 'VENCIDA']

export async function getDocumentosPendientesCliente(clienteId: number, monedaId?: number) {
  const whereBase = {
    clienteId,
    eliminadoEn: null,
    estado: 'APROBADA' as const,
    estadoCobranza: { in: ESTADOS_CARTERA_ACTIVOS },
    ...(monedaId ? { monedaId } : {}),
  }
  const [exp, nac] = await Promise.all([
    prisma.facturaExportacion.findMany({
      where: whereBase,
      select: {
        id: true,
        codigo: true,
        monedaId: true,
        moneda: { select: { id: true, codigo: true } },
        montoTotal: true,
        estadoCobranza: true,
        fechaEmision: true,
        cuotas: { select: cuotaSelect, orderBy: { numeroCuota: 'asc' } },
      },
      orderBy: { id: 'asc' },
    }),
    prisma.facturaNacional.findMany({
      where: whereBase,
      select: {
        id: true,
        codigo: true,
        monedaId: true,
        moneda: { select: { id: true, codigo: true } },
        montoTotal: true,
        estadoCobranza: true,
        fechaEmision: true,
        cuotas: { select: cuotaSelect, orderBy: { numeroCuota: 'asc' } },
      },
      orderBy: { id: 'asc' },
    }),
  ])

  const normalizar = (tipoFactura: TipoFacturaCobranza) => (f: (typeof exp)[number]) => {
    const saldoTotal = sumarMontos(f.cuotas.map((c) => Number(c.saldoPendiente)))
    return {
      tipoFactura,
      id: f.id,
      codigo: f.codigo,
      moneda: f.moneda,
      montoTotal: f.montoTotal,
      estadoCobranza: f.estadoCobranza,
      fechaEmision: f.fechaEmision,
      saldoPendiente: saldoTotal,
      cuotas: f.cuotas,
    }
  }
  return [...exp.map(normalizar('EXPORTACION')), ...(nac as typeof exp).map(normalizar('NACIONAL'))]
}

// ─── Lectura transaccional de una factura con sus cuotas (bajo lock) ──────────
async function cargarFacturaCartera(tx: Tx, tipo: TipoFacturaCobranza, id: number): Promise<FacturaCartera> {
  if (tipo === 'EXPORTACION') {
    const f = await tx.facturaExportacion.findFirst({
      where: { id, eliminadoEn: null },
      select: { id: true, codigo: true, clienteId: true, monedaId: true, estado: true, cuotas: { select: cuotaSelect, orderBy: { numeroCuota: 'asc' } } },
    })
    if (!f) throw new ValidationError(`La Factura de Exportación #${id} no existe o fue anulada`)
    return { tipoFactura: tipo, id: f.id, codigo: f.codigo, clienteId: f.clienteId, monedaId: f.monedaId, estadoSii: f.estado, cuotas: f.cuotas.map(mapCuota) }
  }
  const f = await tx.facturaNacional.findFirst({
    where: { id, eliminadoEn: null },
    select: { id: true, codigo: true, clienteId: true, monedaId: true, estado: true, cuotas: { select: cuotaSelect, orderBy: { numeroCuota: 'asc' } } },
  })
  if (!f) throw new ValidationError(`La Factura Nacional #${id} no existe o fue anulada`)
  return { tipoFactura: tipo, id: f.id, codigo: f.codigo, clienteId: f.clienteId, monedaId: f.monedaId, estadoSii: f.estado, cuotas: f.cuotas.map(mapCuota) }
}

// Lock por factura (serializa aplicaciones concurrentes sobre el mismo saldo de
// cuotas). Mismo namespace, clave distinta a la del saldo a favor.
async function lockFactura(tx: Tx, tipo: TipoFacturaCobranza, id: number) {
  const clave = `${tipo}:${id}`
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_NAMESPACE_COBRANZA_PAGO}::int, hashtext(${clave}))`
}

// Lock por saldo a favor (FAS-COB-PAG-R1-001): dos aplicaciones del MISMO saldo a
// favor sobre facturas DISTINTAS tomarían locks de factura distintos y leerían
// ambas el mismo montoDisponible, gastándolo dos veces. Se toma ESTE lock antes
// del de factura (orden global saldo→factura, sin ciclo con crearPago que nunca
// bloquea saldos) y se re-lee el saldo bajo él.
async function lockSaldo(tx: Tx, saldoId: number) {
  const clave = `SALDO:${saldoId}`
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_NAMESPACE_COBRANZA_PAGO}::int, hashtext(${clave}))`
}

// Distribuye `monto` (en moneda de la factura) sobre las cuotas en orden
// ascendente (CB11/D10), hasta el saldoPendiente de cada una; actualiza cada
// cuota (montoPagado/saldoPendiente/estado) y muta `cuotas` en memoria para que
// el caller derive el estadoCobranza. Devuelve el detalle aplicado por cuota.
// Asume que `monto` ≤ Σ saldoPendiente (validado por el caller).
async function aplicarMontoACuotas(
  tx: Tx,
  tipo: TipoFacturaCobranza,
  cuotas: CuotaCartera[],
  monto: number,
): Promise<Array<{ cuotaId: number; monto: number }>> {
  // La matemática de la cascada vive en una función pura (testeable sin BD).
  const { aplicaciones } = distribuirEnCuotas(cuotas, monto, inicioDeHoy())
  const porId = new Map(cuotas.map((c) => [c.id, c]))
  for (const a of aplicaciones) {
    if (tipo === 'EXPORTACION') {
      await tx.facturaExportacionCuota.update({ where: { id: a.cuotaId }, data: { montoPagado: a.nuevoPagado, saldoPendiente: a.nuevoSaldo, estado: a.estado } })
    } else {
      await tx.facturaNacionalCuota.update({ where: { id: a.cuotaId }, data: { montoPagado: a.nuevoPagado, saldoPendiente: a.nuevoSaldo, estado: a.estado } })
    }
    // Muta en memoria para que el caller derive el estadoCobranza actualizado.
    const cuota = porId.get(a.cuotaId)!
    cuota.saldoPendiente = a.nuevoSaldo
    cuota.montoPagado = a.nuevoPagado
  }
  return aplicaciones.map((a) => ({ cuotaId: a.cuotaId, monto: a.monto }))
}

async function actualizarEstadoCobranzaFactura(tx: Tx, factura: FacturaCartera) {
  const estadoCobranza = derivarEstadoCobranza(
    factura.cuotas.map((c) => ({ montoCuota: c.montoCuota, saldoPendiente: c.saldoPendiente, fechaVencimiento: c.fechaVencimiento })),
    inicioDeHoy(),
  )
  if (factura.tipoFactura === 'EXPORTACION') {
    await tx.facturaExportacion.update({ where: { id: factura.id }, data: { estadoCobranza } })
  } else {
    await tx.facturaNacional.update({ where: { id: factura.id }, data: { estadoCobranza } })
  }
}

// ─── Crear pago (transacción atómica) ─────────────────────────────────────────
export async function crearPagoTransaccional(input: CrearPagoInput, codigo: string, userId: string) {
  const empresaId = getEmpresaIdActual()
  if (empresaId == null) throw new ValidationError('No hay una empresa activa')

  return prisma.$transaction(async (tx) => {
    // Toma los locks de todas las facturas destino en orden estable (tipo, id).
    const objetivos = [...input.aplicaciones].sort((a, b) =>
      a.tipoFactura === b.tipoFactura ? a.facturaId - b.facturaId : a.tipoFactura.localeCompare(b.tipoFactura),
    )
    for (const ap of objetivos) await lockFactura(tx, ap.tipoFactura, ap.facturaId)

    // Re-lee cada factura BAJO lock y valida contra su saldo real actual.
    // rawConsumido acumula SIN redondear por ítem (FAS-COB-PAG-R1-002: redondear
    // cada cociente erosionaba la suma y permitía abonar a facturas sin consumir
    // el monto equivalente del pago). Se redondea una sola vez al final.
    let rawConsumido = 0
    const plan: Array<{ ap: PagoAplicacionInput; factura: FacturaCartera }> = []
    for (const ap of input.aplicaciones) {
      const factura = await cargarFacturaCartera(tx, ap.tipoFactura, ap.facturaId)
      if (!esFacturaTimbrada(factura.estadoSii)) {
        throw new ValidationError(`La factura ${factura.codigo} no está timbrada ante el SII — no admite pagos`)
      }
      if (factura.clienteId !== input.clienteId) {
        throw new ValidationError(`La factura ${factura.codigo} pertenece a otro cliente (CB11)`)
      }
      if (factura.cuotas.length === 0) {
        throw new ValidationError(`La factura ${factura.codigo} no tiene cuotas de cartera`)
      }
      // Moneda: igual a la del pago → tipoCambio debe ser 1; distinta → requiere
      // un tipoCambio distinto de 1 (conversión, supersesión D9).
      const mismaMoneda = factura.monedaId === input.monedaId
      if (mismaMoneda && Math.abs(ap.tipoCambio - 1) > 1e-9) {
        throw new ValidationError(`La factura ${factura.codigo} está en la misma moneda del pago — el tipo de cambio debe ser 1`)
      }
      const saldoTotal = sumarMontos(factura.cuotas.map((c) => c.saldoPendiente))
      if (ap.montoAplicado > saldoTotal + EPSILON) {
        throw new ValidationError(
          `El monto aplicado a ${factura.codigo} (${ap.montoAplicado}) supera su saldo pendiente (${saldoTotal})`,
        )
      }
      // Lo que esta aplicación consume del pago (en su moneda). Si redondea a
      // menos de un centavo representable, abonaría a la factura "gratis"
      // (FAS-COB-PAG-R1-002) → se rechaza con mensaje accionable.
      const consumidoItem = ap.montoAplicado / ap.tipoCambio
      if (round2(consumidoItem) < 0.01) {
        throw new ValidationError(
          `El monto aplicado a ${factura.codigo} es demasiado pequeño para el tipo de cambio (${ap.tipoCambio}): consumiría menos de un centavo del pago`,
        )
      }
      rawConsumido += consumidoItem
      plan.push({ ap, factura })
    }

    const sumaConsumidoPago = round2(rawConsumido)
    if (sumaConsumidoPago > input.monto + EPSILON) {
      throw new ValidationError(
        `Las aplicaciones consumen ${sumaConsumidoPago} del pago, que supera su monto (${input.monto})`,
      )
    }

    // Crea el Pago (la extensión tenant reinyecta empresaId; se pasa explícito
    // por el tipado y como el resto del módulo).
    const pago = await tx.pago.create({
      data: {
        empresaId,
        codigo,
        clienteId: input.clienteId,
        fecha: new Date(input.fecha),
        monto: input.monto,
        monedaId: input.monedaId,
        medioPago: input.medioPago,
        referencia: input.referencia ?? null,
        observacion: input.observacion ?? null,
        creadoPorId: userId,
      },
      select: { id: true },
    })

    // Aplica a cada factura (documento + cascada a cuotas).
    for (const { ap, factura } of plan) {
      const doc = await tx.pagoAplicacionDocumento.create({
        data: {
          empresaId,
          pagoId: pago.id,
          facturaExportacionId: ap.tipoFactura === 'EXPORTACION' ? ap.facturaId : null,
          facturaNacionalId: ap.tipoFactura === 'NACIONAL' ? ap.facturaId : null,
          tipoCambioAplicado: ap.tipoCambio,
          montoAplicado: ap.montoAplicado,
        },
        select: { id: true },
      })
      const detalle = await aplicarMontoACuotas(tx, ap.tipoFactura, factura.cuotas, ap.montoAplicado)
      for (const d of detalle) {
        await tx.pagoAplicacionCuota.create({
          data: {
            empresaId,
            pagoAplicacionDocumentoId: doc.id,
            facturaExportacionCuotaId: ap.tipoFactura === 'EXPORTACION' ? d.cuotaId : null,
            facturaNacionalCuotaId: ap.tipoFactura === 'NACIONAL' ? d.cuotaId : null,
            monto: d.monto,
          },
        })
      }
      await actualizarEstadoCobranzaFactura(tx, factura)
    }

    // Remanente no aplicado → saldo a favor del cliente (CB12), en la moneda del
    // pago.
    const remanente = round2(input.monto - sumaConsumidoPago)
    if (remanente >= 0.01) {
      await tx.saldoAFavorCliente.create({
        data: {
          empresaId,
          clienteId: input.clienteId,
          monedaId: input.monedaId,
          montoOriginal: remanente,
          montoDisponible: remanente,
          pagoOrigenId: pago.id,
          creadoPorId: userId,
        },
      })
    }

    return getPagoByIdTx(tx, pago.id)
  })
}

// ─── Aplicar un saldo a favor existente a una factura (CB13) ──────────────────
export async function getSaldoAFavorActivo(id: number) {
  return prisma.saldoAFavorCliente.findFirst({
    where: { id, eliminadoEn: null },
    select: { id: true, clienteId: true, monedaId: true, montoDisponible: true },
  })
}

export async function aplicarSaldoAFavorTransaccional(
  saldoId: number,
  tipoFactura: TipoFacturaCobranza,
  facturaId: number,
  monto: number,
) {
  const empresaId = getEmpresaIdActual()
  if (empresaId == null) throw new ValidationError('No hay una empresa activa')

  return prisma.$transaction(async (tx) => {
    // Orden global de locks: saldo primero, luego factura (evita doble gasto del
    // saldo entre aplicaciones concurrentes a facturas distintas, FAS-COB-PAG-R1-001).
    await lockSaldo(tx, saldoId)
    await lockFactura(tx, tipoFactura, facturaId)
    // Re-lee el saldo bajo el lock.
    const saldo = await tx.saldoAFavorCliente.findFirst({
      where: { id: saldoId, eliminadoEn: null },
      select: { id: true, clienteId: true, monedaId: true, montoDisponible: true },
    })
    if (!saldo) throw new ValidationError('El saldo a favor no existe o fue anulado')
    const disponible = Number(saldo.montoDisponible)
    if (disponible <= 0) throw new ValidationError('El saldo a favor no tiene monto disponible')

    const factura = await cargarFacturaCartera(tx, tipoFactura, facturaId)
    if (!esFacturaTimbrada(factura.estadoSii)) throw new ValidationError(`La factura ${factura.codigo} no está timbrada ante el SII — no admite aplicaciones`)
    if (factura.clienteId !== saldo.clienteId) throw new ValidationError('El saldo a favor pertenece a otro cliente (CB13)')
    if (factura.monedaId !== saldo.monedaId) throw new ValidationError('El saldo a favor está en otra moneda que la factura (CB13)')
    if (factura.cuotas.length === 0) throw new ValidationError(`La factura ${factura.codigo} no tiene cuotas de cartera`)

    const saldoTotalFactura = sumarMontos(factura.cuotas.map((c) => c.saldoPendiente))
    if (monto > disponible + EPSILON) throw new ValidationError(`El monto a aplicar (${monto}) supera el saldo a favor disponible (${disponible})`)
    if (monto > saldoTotalFactura + EPSILON) throw new ValidationError(`El monto a aplicar (${monto}) supera el saldo pendiente de la factura (${saldoTotalFactura})`)

    await aplicarMontoACuotas(tx, tipoFactura, factura.cuotas, monto)
    await actualizarEstadoCobranzaFactura(tx, factura)

    await tx.saldoAFavorAplicacion.create({
      data: {
        empresaId,
        saldoAFavorId: saldo.id,
        facturaExportacionId: tipoFactura === 'EXPORTACION' ? facturaId : null,
        facturaNacionalId: tipoFactura === 'NACIONAL' ? facturaId : null,
        monto,
      },
    })
    await tx.saldoAFavorCliente.update({
      where: { id: saldo.id },
      data: { montoDisponible: round2(disponible - monto) },
    })

    return cargarFacturaCartera(tx, tipoFactura, facturaId)
  })
}

// ─── Lecturas de pagos / saldo a favor ────────────────────────────────────────
const pagoInclude = {
  cliente: { select: { id: true, codigo: true, descripcion: true, razonSocial: true } },
  moneda: { select: { id: true, codigo: true, descripcion: true } },
  aplicaciones: {
    select: {
      id: true,
      montoAplicado: true,
      tipoCambioAplicado: true,
      facturaExportacionId: true,
      facturaExportacion: { select: { codigo: true } },
      facturaNacionalId: true,
      facturaNacional: { select: { codigo: true } },
    },
  },
  saldoAFavorGenerado: { select: { id: true, montoOriginal: true, montoDisponible: true } },
} satisfies Prisma.PagoInclude

async function getPagoByIdTx(tx: Tx, id: number) {
  return tx.pago.findFirst({ where: { id }, include: pagoInclude })
}

export async function getPagoById(id: number) {
  return prisma.pago.findFirst({ where: { id, eliminadoEn: null }, include: pagoInclude })
}

export async function listPagos(filters: PagosListFilters) {
  const { page, limit } = filters
  const where: Prisma.PagoWhereInput = {
    eliminadoEn: null,
    ...(filters.clienteId ? { clienteId: filters.clienteId } : {}),
    ...(filters.desde || filters.hasta
      ? {
          fecha: {
            ...(filters.desde ? { gte: new Date(filters.desde) } : {}),
            ...(filters.hasta ? { lte: new Date(`${filters.hasta}T23:59:59.999Z`) } : {}),
          },
        }
      : {}),
  }
  const [data, total] = await Promise.all([
    prisma.pago.findMany({ where, include: pagoInclude, orderBy: { id: 'desc' }, skip: (page - 1) * limit, take: limit }),
    prisma.pago.count({ where }),
  ])
  return { data, meta: { total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) } }
}

// ─── Ciclo 3: barrido diario de vencimientos (CB14/CB15) ──────────────────────
// Empresas activas para iterar el barrido (Empresa NO es modelo tenant: se lee
// sin contexto de empresa, devuelve todas).
export async function getEmpresasActivas() {
  return prisma.empresa.findMany({ where: { activo: true, eliminadoEn: null }, select: { id: true } })
}

const EMBARQUE_FECHAS_SELECT = {
  reservaManual: true,
  fechaZarpeManual: true,
  fechaArribo: true,
  solicitudReserva: { select: { fechaZarpe: true } },
} as const

type EmbarqueFechas = {
  reservaManual: boolean
  fechaZarpeManual: Date | null
  fechaArribo: Date | null
  solicitudReserva: { fechaZarpe: Date | null } | null
} | null

// Fechas base para los vencimientos (CB6): FACTURA = fecha del documento;
// ZARPE/ARRIBO del Embarque (si lo hay); ENVIO_DOCUMENTOS sin fuente aún.
function fechasBase(fechaDocumento: Date | null, fechaEmision: Date | null, emb: EmbarqueFechas): FechasBase {
  const zarpe = emb ? (emb.reservaManual ? emb.fechaZarpeManual : emb.solicitudReserva?.fechaZarpe ?? null) : null
  return { FACTURA: fechaDocumento ?? fechaEmision ?? null, ZARPE: zarpe, ARRIBO: emb?.fechaArribo ?? null, ENVIO_DOCUMENTOS: null }
}

// Refresca UNA factura bajo su advisory lock (serializa con los pagos, FAS-COB-
// PAG-R1-001): recalcula vencimientos desde las fechas base actuales (CB6/D7),
// re-deriva el estado de cada cuota (CB14) y el estadoCobranza (CB15). Devuelve
// cuántas cuotas cambiaron y si cambió el estado de la factura.
async function refrescarFacturaCartera(tipo: TipoFacturaCobranza, facturaId: number, fechas: FechasBase, hoy: Date) {
  return prisma.$transaction(async (tx) => {
    await lockFactura(tx, tipo, facturaId)
    const cuotas =
      tipo === 'EXPORTACION'
        ? await tx.facturaExportacionCuota.findMany({ where: { facturaExportacionId: facturaId }, select: cuotaSelect, orderBy: { numeroCuota: 'asc' } })
        : await tx.facturaNacionalCuota.findMany({ where: { facturaNacionalId: facturaId }, select: cuotaSelect, orderBy: { numeroCuota: 'asc' } })

    const plan = planRefresco(
      cuotas.map((c) => ({
        id: c.id,
        fechaReferencia: c.fechaReferencia,
        plazoDias: c.plazoDias,
        montoCuota: Number(c.montoCuota),
        saldoPendiente: Number(c.saldoPendiente),
        fechaVencimiento: c.fechaVencimiento,
        estado: c.estado,
      })),
      fechas,
      hoy,
    )

    for (const u of plan.cuotaUpdates) {
      if (tipo === 'EXPORTACION') {
        await tx.facturaExportacionCuota.update({ where: { id: u.id }, data: { fechaVencimiento: u.fechaVencimiento, estado: u.estado } })
      } else {
        await tx.facturaNacionalCuota.update({ where: { id: u.id }, data: { fechaVencimiento: u.fechaVencimiento, estado: u.estado } })
      }
    }

    let facturaCambio = 0
    if (tipo === 'EXPORTACION') {
      const upd = await tx.facturaExportacion.updateMany({ where: { id: facturaId, estadoCobranza: { not: plan.estadoCobranza } }, data: { estadoCobranza: plan.estadoCobranza } })
      facturaCambio = upd.count
    } else {
      const upd = await tx.facturaNacional.updateMany({ where: { id: facturaId, estadoCobranza: { not: plan.estadoCobranza } }, data: { estadoCobranza: plan.estadoCobranza } })
      facturaCambio = upd.count
    }
    return { cuotas: plan.cuotaUpdates.length, factura: facturaCambio }
  })
}

// Refresca la cartera activa de la EMPRESA ACTIVA en contexto (Ciclo 3): recorre
// sus facturas con estadoCobranza activo (PENDIENTE/PARCIAL/VENCIDA) y refresca
// cada una bajo su lock. Las SIN_CUOTAS y PAGADA se omiten (nada que hacer).
export async function refrescarCarteraEmpresaActual(hoy: Date) {
  if (getEmpresaIdActual() == null) throw new ValidationError('El barrido de vencimientos requiere una empresa en contexto')

  const [exp, nac] = await Promise.all([
    prisma.facturaExportacion.findMany({
      where: { eliminadoEn: null, estadoCobranza: { in: ESTADOS_CARTERA_ACTIVOS } },
      select: { id: true, fechaDocumento: true, fechaEmision: true, embarque: { select: EMBARQUE_FECHAS_SELECT } },
    }),
    prisma.facturaNacional.findMany({
      where: { eliminadoEn: null, estadoCobranza: { in: ESTADOS_CARTERA_ACTIVOS } },
      select: { id: true, fechaDocumento: true, fechaEmision: true, embarque: { select: EMBARQUE_FECHAS_SELECT } },
    }),
  ])

  const totales = { facturas: 0, cuotas: 0 }
  for (const f of exp) {
    const r = await refrescarFacturaCartera('EXPORTACION', f.id, fechasBase(f.fechaDocumento, f.fechaEmision, f.embarque), hoy)
    totales.facturas += r.factura
    totales.cuotas += r.cuotas
  }
  for (const f of nac) {
    const r = await refrescarFacturaCartera('NACIONAL', f.id, fechasBase(f.fechaDocumento, f.fechaEmision, f.embarque), hoy)
    totales.facturas += r.factura
    totales.cuotas += r.cuotas
  }
  return totales
}

export async function getSaldosAFavorCliente(clienteId: number) {
  return prisma.saldoAFavorCliente.findMany({
    where: { clienteId, eliminadoEn: null, montoDisponible: { gt: 0 } },
    select: {
      id: true,
      montoOriginal: true,
      montoDisponible: true,
      fecha: true,
      moneda: { select: { id: true, codigo: true, descripcion: true } },
      pagoOrigen: { select: { id: true, codigo: true } },
    },
    orderBy: { id: 'desc' },
  })
}
