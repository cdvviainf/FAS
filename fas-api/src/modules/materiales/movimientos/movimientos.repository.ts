import { prisma } from '../../../lib/prisma.js'
import type { Prisma, PrismaClient } from '@prisma/client'
import type { MovimientoCreateInput, MovimientoListFilters } from './movimientos.types.js'

const includeDetalle = {
  tipoMovimiento: { select: { id: true, codigo: true, descripcion: true, clase: true, emiteDTE: true } },
  entidad: { select: { id: true, codigo: true, descripcion: true, razonSocial: true } },
  transporteEntidad: { select: { id: true, codigo: true, descripcion: true, razonSocial: true } },
  bodegaOrigen: { select: { id: true, codigo: true, descripcion: true } },
  bodegaDestino: { select: { id: true, codigo: true, descripcion: true } },
  detalle: {
    include: { articulo: { select: { id: true, codigo: true, descripcion: true } } },
  },
} satisfies Prisma.MovimientoInclude

function buildWhere(filters: MovimientoListFilters): Prisma.MovimientoWhereInput {
  return {
    ...(filters.tipoMovimientoId ? { tipoMovimientoId: filters.tipoMovimientoId } : {}),
    ...(filters.bodegaId
      ? { OR: [{ bodegaOrigenId: filters.bodegaId }, { bodegaDestinoId: filters.bodegaId }] }
      : {}),
    ...((filters.fechaDesde || filters.fechaHasta)
      ? {
          fechaMovimiento: {
            ...(filters.fechaDesde ? { gte: new Date(filters.fechaDesde) } : {}),
            ...(filters.fechaHasta ? { lte: new Date(`${filters.fechaHasta}T23:59:59.999Z`) } : {}),
          },
        }
      : {}),
  }
}

export async function listMovimientos(filters: MovimientoListFilters) {
  const { page = 1, limit = 20 } = filters
  const where = buildWhere(filters)
  const [data, total] = await Promise.all([
    prisma.movimiento.findMany({
      where,
      include: includeDetalle,
      orderBy: { fechaMovimiento: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.movimiento.count({ where }),
  ])
  return { data, total }
}

export async function getMovimientoById(id: number) {
  return prisma.movimiento.findUnique({ where: { id }, include: includeDetalle })
}

// ─── Validación de referencias ───────────────────────────────────────────────

export async function getTipoMovimientoActivo(id: number) {
  return prisma.tipoMovimiento.findFirst({ where: { id, activo: true } })
}

export async function getArticulosPorIds(ids: number[]) {
  return prisma.articulo.findMany({
    where: { id: { in: ids } },
    select: { id: true, tipo: true, controlaStock: true, activo: true },
  })
}

export async function getEntidadActiva(id: number) {
  return prisma.entidad.findFirst({ where: { id, eliminadoEn: null, activo: true } })
}

// ─── Motor transaccional (R1-R14) ────────────────────────────────────────────

type Tx = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

async function getOrCreateSaldo(tx: Tx, articuloId: number, bodegaId: number) {
  const existente = await tx.saldoArticulo.findUnique({
    where: { articuloId_bodegaId: { articuloId, bodegaId } },
  })
  if (existente) return existente
  return tx.saldoArticulo.create({
    data: { articuloId, bodegaId, cantidad: 0, costoPromedio: 0 },
  })
}

/**
 * Crea el movimiento y aplica el efecto en SaldoArticulo dentro de una única
 * transacción (R7). Lanza si algún SALIDA/TRASLADO deja saldo negativo (R2) —
 * la transacción completa hace rollback (R19/CA19).
 */
export async function createMovimientoTransaccional(
  data: MovimientoCreateInput,
  clase: 'ENTRADA' | 'SALIDA' | 'TRASLADO',
  articulosPorId: Map<number, { controlaStock: boolean }>,
  userId: string,
) {
  return prisma.$transaction(async (tx) => {
    const { detalle, fechaMovimiento, horaSalida, horaEstimadaLlegada, ...cabecera } = data

    const movimiento = await tx.movimiento.create({
      data: {
        ...cabecera,
        fechaMovimiento: new Date(fechaMovimiento),
        horaSalida: horaSalida ? new Date(horaSalida) : null,
        horaEstimadaLlegada: horaEstimadaLlegada ? new Date(horaEstimadaLlegada) : null,
        usuarioId: userId,
        detalle: {
          create: detalle.map((d) => ({
            articuloId: d.articuloId,
            cantidad: d.cantidad,
            precioUnitario: d.precioUnitario ?? null,
          })),
        },
      },
      include: includeDetalle,
    })

    for (const linea of detalle) {
      const articulo = articulosPorId.get(linea.articuloId)
      if (!articulo?.controlaStock) continue // R8: sin control de stock, no genera saldo

      if (clase === 'ENTRADA') {
        const saldo = await getOrCreateSaldo(tx, linea.articuloId, data.bodegaDestinoId!)
        const cantidadActual = Number(saldo.cantidad)
        const pmpActual = Number(saldo.costoPromedio)
        const nuevaCantidad = cantidadActual + linea.cantidad
        // R5: recalcula PMP solo si viene precio (requierePrecio ya validado en service)
        const nuevoPmp =
          linea.precioUnitario != null
            ? (cantidadActual * pmpActual + linea.cantidad * linea.precioUnitario) / nuevaCantidad
            : pmpActual
        await tx.saldoArticulo.update({
          where: { articuloId_bodegaId: { articuloId: linea.articuloId, bodegaId: data.bodegaDestinoId! } },
          data: { cantidad: nuevaCantidad, costoPromedio: nuevoPmp },
        })
      } else if (clase === 'SALIDA') {
        const saldo = await getOrCreateSaldo(tx, linea.articuloId, data.bodegaOrigenId!)
        const cantidadActual = Number(saldo.cantidad)
        if (cantidadActual < linea.cantidad) {
          throw new StockInsuficienteError(linea.articuloId, data.bodegaOrigenId!, cantidadActual, linea.cantidad)
        }
        // R6: la salida se valoriza al PMP vigente pero no lo modifica
        await tx.saldoArticulo.update({
          where: { articuloId_bodegaId: { articuloId: linea.articuloId, bodegaId: data.bodegaOrigenId! } },
          data: { cantidad: cantidadActual - linea.cantidad },
        })
      } else {
        // TRASLADO: R6 — el PMP viaja con la cantidad al destino
        const saldoOrigen = await getOrCreateSaldo(tx, linea.articuloId, data.bodegaOrigenId!)
        const cantidadOrigen = Number(saldoOrigen.cantidad)
        if (cantidadOrigen < linea.cantidad) {
          throw new StockInsuficienteError(linea.articuloId, data.bodegaOrigenId!, cantidadOrigen, linea.cantidad)
        }
        const pmpOrigen = Number(saldoOrigen.costoPromedio)

        const saldoDestino = await getOrCreateSaldo(tx, linea.articuloId, data.bodegaDestinoId!)
        const cantidadDestino = Number(saldoDestino.cantidad)
        const pmpDestino = Number(saldoDestino.costoPromedio)
        const nuevaCantidadDestino = cantidadDestino + linea.cantidad
        const nuevoPmpDestino = (cantidadDestino * pmpDestino + linea.cantidad * pmpOrigen) / nuevaCantidadDestino

        await tx.saldoArticulo.update({
          where: { articuloId_bodegaId: { articuloId: linea.articuloId, bodegaId: data.bodegaOrigenId! } },
          data: { cantidad: cantidadOrigen - linea.cantidad },
        })
        await tx.saldoArticulo.update({
          where: { articuloId_bodegaId: { articuloId: linea.articuloId, bodegaId: data.bodegaDestinoId! } },
          data: { cantidad: nuevaCantidadDestino, costoPromedio: nuevoPmpDestino },
        })
      }
    }

    return movimiento
  })
}

export class StockInsuficienteError extends Error {
  constructor(
    public readonly articuloId: number,
    public readonly bodegaId: number,
    public readonly disponible: number,
    public readonly solicitado: number,
  ) {
    super(`Stock insuficiente para el artículo ${articuloId} en la bodega ${bodegaId}: disponible ${disponible}, solicitado ${solicitado}`)
  }
}

// ─── Saldos / consulta de stock ──────────────────────────────────────────────

export async function listSaldos(filters: { bodegaId?: number; tipo?: string; bajoCritico?: boolean }) {
  const where: Prisma.SaldoArticuloWhereInput = {
    ...(filters.bodegaId ? { bodegaId: filters.bodegaId } : {}),
    ...(filters.tipo ? { articulo: { tipo: filters.tipo as Prisma.EnumTipoArticuloFilter['equals'] } } : {}),
  }
  const saldos = await prisma.saldoArticulo.findMany({
    where,
    include: {
      articulo: { select: { id: true, codigo: true, descripcion: true, tipo: true, stockCritico: true, controlaStock: true } },
      bodega: { select: { id: true, codigo: true, descripcion: true } },
    },
    orderBy: [{ articulo: { codigo: 'asc' } }],
  })
  if (!filters.bajoCritico) return saldos
  return saldos.filter((s) => s.articulo.stockCritico != null && Number(s.cantidad) < Number(s.articulo.stockCritico))
}

export async function getRecetasConDetalle(articuloIds: number[]) {
  return prisma.receta.findMany({
    where: { embalajeId: { in: articuloIds }, activo: true },
    include: { detalle: { include: { componente: true } } },
  })
}

// R15: siempre se devuelven TODAS las bodegas; el filtro de bodegas solo
// afecta el cálculo del motivo "Trasladar" en el service, no qué se muestra.
export async function getSaldosPorArticulos(articuloIds: number[]) {
  return prisma.saldoArticulo.findMany({
    where: { articuloId: { in: articuloIds } },
    include: { bodega: { select: { id: true, codigo: true, descripcion: true } } },
  })
}
