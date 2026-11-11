import { Prisma } from '@prisma/client'
import { prisma } from '../../../lib/prisma.js'
import { getEmpresaIdActual } from '../../../lib/empresa-context.js'
import { LOCK_NAMESPACE_SOLICITUD_PAGO_NUMERO, LOCK_NAMESPACE_SOLICITUD_PAGO_PRODUCTOR } from '../../../shared/advisory-locks.js'
import type { EstadoSolicitudPago } from './solicitudes-pago.types.js'

type Tx = Prisma.TransactionClient

const mantenedorSelect = { id: true, codigo: true, descripcion: true }

// ─── Despachado ──────────────────────────────────────────────────────────────

export interface FiltrosDespachado {
  // Sin productor = todos (listado de pendientes de pago).
  entidadProductorId?: number
  ordenCompraId?: number
  embarqueId?: number
  temporadaId?: number
}

// Pallets vigentes, recepcionados contra una OC (por cajas o granel) del
// productor, en Embarques con despacho CONFIRMADO y no anulado.
export async function getPalletsDespachados(f: FiltrosDespachado, db: Tx | typeof prisma = prisma) {
  return db.pallet.findMany({
    where: {
      eliminadoEn: null,
      embarque: {
        eliminadoEn: null,
        despachadoEn: { not: null },
        despachoAnuladoEn: null,
        ...(f.embarqueId ? { id: f.embarqueId } : {}),
      },
      recepcion: {
        eliminadoEn: null,
        ordenCompra: {
          eliminadoEn: null,
          ...(f.entidadProductorId ? { entidadProductorId: f.entidadProductorId } : {}),
          ...(f.ordenCompraId ? { id: f.ordenCompraId } : {}),
          ...(f.temporadaId ? { temporadaId: f.temporadaId } : {}),
        },
      },
    },
    orderBy: [{ embarqueId: 'asc' }, { numeroPallet: 'asc' }],
    select: {
      id: true,
      numeroPallet: true,
      embarque: {
        select: {
          id: true,
          numeroInstructivo: true,
          reservaManual: true,
          fechaZarpeManual: true,
          fechaArribo: true,
          solicitudReserva: { select: { fechaZarpe: true } },
        },
      },
      recepcion: { select: { ordenCompraId: true } },
      lineas: {
        orderBy: { id: 'asc' },
        select: {
          especieId: true,
          variedadId: true,
          categoriaId: true,
          articuloId: true,
          etiquetaId: true,
          calibreId: true,
          cajas: true,
          especie: { select: { descripcion: true } },
          variedad: { select: { descripcion: true } },
          categoria: { select: { descripcion: true } },
          calibre: { select: { descripcion: true } },
          etiqueta: { select: { descripcion: true } },
          articulo: { select: { descripcion: true, descripcionComercial: true, kgNetoEnvase: true } },
        },
      },
    },
  })
}

// OC con lo necesario para valorizar y armar cuotas.
export async function getOrdenesParaPago(ids: number[], db: Tx | typeof prisma = prisma) {
  if (ids.length === 0) return []
  return db.ordenCompra.findMany({
    where: { id: { in: ids }, eliminadoEn: null },
    select: {
      id: true,
      numero: true,
      modalidad: true,
      entidadProductor: { select: { id: true, codigo: true, razonSocial: true } },
      monedaId: true,
      moneda: { select: mantenedorSelect },
      temporadaId: true,
      condicionPago: { select: mantenedorSelect },
      lineas: {
        select: {
          id: true,
          especieId: true,
          variedadId: true,
          categoriaId: true,
          articuloId: true,
          etiquetaId: true,
          precioUsdCaja: true,
          calibres: { select: { calibreId: true } },
        },
      },
      cuotasPago: {
        orderBy: { id: 'asc' },
        select: {
          id: true,
          fechaReferencia: true,
          plazoDias: true,
          tipoValor: true,
          porcentaje: true,
          valorUnitario: true,
          monedaId: true,
          descripcion: true,
          unidad: { select: { codigo: true } },
        },
      },
    },
  })
}

// Σ montoSolicitado por (OC, Embarque, cuota) en solicitudes no anuladas.
// `excluirSolicitudId`: al editar, no cuenta lo de la propia solicitud.
export async function getSolicitadoPorCuota(ordenCompraIds: number[], excluirSolicitudId: number | null, db: Tx | typeof prisma = prisma) {
  if (ordenCompraIds.length === 0) return []
  return db.solicitudPagoLinea.groupBy({
    by: ['ordenCompraId', 'embarqueId', 'ordenCompraCuotaPagoId'],
    where: {
      ordenCompraId: { in: ordenCompraIds },
      solicitudPago: {
        empresaId: getEmpresaIdActual()!,
        estado: { not: 'ANULADA' },
        ...(excluirSolicitudId ? { id: { not: excluirSolicitudId } } : {}),
      },
    },
    _sum: { montoSolicitado: true },
  })
}

// ─── Solicitudes ─────────────────────────────────────────────────────────────

const solicitudInclude = {
  entidadProductor: { select: { id: true, codigo: true, razonSocial: true, identificador: true } },
  moneda: { select: mantenedorSelect },
  temporada: { select: mantenedorSelect },
  conceptoCtaCte: { select: { id: true, codigo: true, descripcion: true, naturaleza: true } },
  lineas: {
    orderBy: [{ ordenCompraId: 'asc' }, { embarqueId: 'asc' }, { numeroCuota: 'asc' }],
    select: {
      id: true,
      ordenCompraId: true,
      ordenCompra: { select: { id: true, numero: true } },
      embarqueId: true,
      embarque: { select: { id: true, numeroInstructivo: true } },
      ordenCompraCuotaPagoId: true,
      ordenCompraCuotaPago: { select: { descripcion: true, fechaReferencia: true, plazoDias: true } },
      numeroCuota: true,
      fechaVencimiento: true,
      montoCalculado: true,
      montoSolicitado: true,
      numeroFactura: true,
      movimientoCcId: true,
      movimientoAnulacionCcId: true,
    },
  },
} satisfies Prisma.SolicitudPagoInclude

export type SolicitudPagoDetalle = Prisma.SolicitudPagoGetPayload<{ include: typeof solicitudInclude }>

export interface ListFiltros {
  page: number
  limit: number
  entidadProductorId?: number
  estado?: EstadoSolicitudPago
  temporadaId?: number
  q?: string
}

export async function listSolicitudes(f: ListFiltros) {
  const where: Prisma.SolicitudPagoWhereInput = {
    ...(f.entidadProductorId ? { entidadProductorId: f.entidadProductorId } : {}),
    ...(f.estado ? { estado: f.estado } : {}),
    ...(f.temporadaId ? { temporadaId: f.temporadaId } : {}),
    ...(f.q
      ? {
          OR: [
            { numero: { contains: f.q, mode: 'insensitive' } },
            { entidadProductor: { razonSocial: { contains: f.q, mode: 'insensitive' } } },
          ],
        }
      : {}),
  }
  const [data, total] = await Promise.all([
    prisma.solicitudPago.findMany({
      where,
      orderBy: { id: 'desc' },
      skip: (f.page - 1) * f.limit,
      take: f.limit,
      include: {
        entidadProductor: { select: { id: true, codigo: true, razonSocial: true } },
        moneda: { select: mantenedorSelect },
        _count: { select: { lineas: true } },
      },
    }),
    prisma.solicitudPago.count({ where }),
  ])
  return { data, total }
}

export async function getSolicitudById(id: number, db: Tx | typeof prisma = prisma) {
  return db.solicitudPago.findFirst({ where: { id }, include: solicitudInclude })
}

export async function getProductor(id: number) {
  return prisma.entidad.findFirst({
    where: { id, eliminadoEn: null, tipos: { has: 'PRODUCTOR' } },
    select: { id: true, razonSocial: true },
  })
}

export interface LineaPersistir {
  ordenCompraId: number
  embarqueId: number
  ordenCompraCuotaPagoId: number | null
  numeroCuota: number
  fechaVencimiento: Date | null
  montoCalculado: number
  montoSolicitado: number
}

// Lock por productor (saldos) — se toma al inicio de cada transacción de escritura.
export async function lockProductor(tx: Tx, entidadProductorId: number) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_NAMESPACE_SOLICITUD_PAGO_PRODUCTOR}::int, ${entidadProductorId}::int)`
}

export async function siguienteNumero(tx: Tx): Promise<string> {
  const anio = new Date().getFullYear()
  const prefijo = `SP-${anio}-`
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_NAMESPACE_SOLICITUD_PAGO_NUMERO}::int, ${anio}::int)`
  const ultimo = await tx.solicitudPago.findFirst({
    where: { numero: { startsWith: prefijo } },
    orderBy: { numero: 'desc' },
    select: { numero: true },
  })
  const n = ultimo ? Number(ultimo.numero.slice(prefijo.length)) + 1 : 1
  return `${prefijo}${String(n).padStart(4, '0')}`
}

export async function crearSolicitud(
  tx: Tx,
  data: {
    numero: string
    temporadaId: number
    entidadProductorId: number
    monedaId: number
    observaciones: string | null
    montoTotal: number
    lineas: LineaPersistir[]
  },
  userId: string,
) {
  return tx.solicitudPago.create({
    data: {
      // empresaId: la extensión de tenancy lo fija con la empresa activa.
      empresaId: getEmpresaIdActual()!,
      numero: data.numero,
      temporadaId: data.temporadaId,
      entidadProductorId: data.entidadProductorId,
      monedaId: data.monedaId,
      observaciones: data.observaciones,
      montoTotal: data.montoTotal,
      creadoPor: userId,
      lineas: { create: data.lineas },
    },
    include: solicitudInclude,
  })
}

export async function reemplazarLineas(
  tx: Tx,
  id: number,
  data: { observaciones: string | null; montoTotal: number; lineas: LineaPersistir[] },
  userId: string,
) {
  const r = await tx.solicitudPago.updateMany({
    where: { id, estado: 'SOLICITADA' },
    data: { observaciones: data.observaciones, montoTotal: data.montoTotal, actualizadoPor: userId },
  })
  if (r.count === 0) return null
  await tx.solicitudPagoLinea.deleteMany({ where: { solicitudPagoId: id } })
  await tx.solicitudPagoLinea.createMany({ data: data.lineas.map((l) => ({ ...l, solicitudPagoId: id })) })
  return tx.solicitudPago.findFirstOrThrow({ where: { id }, include: solicitudInclude })
}

// Concepto de cta. cte. bloqueado para la transacción (serializa con el mantenedor).
export async function lockConcepto(tx: Tx, conceptoId: number) {
  const [c] = await tx.$queryRaw<Array<{ naturaleza: string; bloqueado: boolean; eliminadoEn: Date | null; empresaId: number }>>(
    Prisma.sql`SELECT naturaleza, bloqueado, "eliminadoEn", "empresaId" FROM conceptos_cta_cte WHERE id = ${conceptoId} FOR UPDATE`,
  )
  return c && c.empresaId === getEmpresaIdActual() ? c : null
}

export async function marcarPagada(
  tx: Tx,
  id: number,
  data: { fechaPago: Date; conceptoCtaCteId: number; numeroTransferencia: string | null },
  userId: string,
) {
  const r = await tx.solicitudPago.updateMany({
    where: { id, estado: 'SOLICITADA' },
    data: { estado: 'PAGADA', ...data, pagadoEn: new Date(), pagadoPor: userId, actualizadoPor: userId },
  })
  return r.count === 1
}

export async function crearMovimientoCc(
  tx: Tx,
  data: {
    entidadId: number
    tipoId: number
    naturaleza: 'DEBE' | 'HABER'
    fecha: Date
    glosa: string
    monto: Prisma.Decimal
    monedaId: number
    referencia: string
    temporadaId: number
  },
  userId: string,
) {
  return tx.movimientoCuentaCorriente.create({
    data: { empresaId: getEmpresaIdActual()!, ...data, usuarioId: userId },
    select: { id: true },
  })
}

export async function actualizarLineaPago(tx: Tx, lineaId: number, data: { numeroFactura?: string; movimientoCcId?: number; movimientoAnulacionCcId?: number }) {
  await tx.solicitudPagoLinea.update({ where: { id: lineaId }, data })
}

export async function marcarAnulada(tx: Tx, id: number, estadoEsperado: EstadoSolicitudPago, userId: string) {
  const r = await tx.solicitudPago.updateMany({
    where: { id, estado: estadoEsperado },
    data: { estado: 'ANULADA', anuladoEn: new Date(), anuladoPor: userId, actualizadoPor: userId },
  })
  return r.count === 1
}

export async function getSolicitudTx(tx: Tx, id: number) {
  return tx.solicitudPago.findFirst({ where: { id }, include: solicitudInclude })
}
