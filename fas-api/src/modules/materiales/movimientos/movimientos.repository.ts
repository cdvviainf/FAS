import { prisma } from '../../../lib/prisma.js'
import type { Prisma, PrismaClient } from '@prisma/client'
import { getEmpresaIdActual } from '../../../lib/empresa-context.js'
import { ValidationError } from '../../../shared/errors.js'
import { LOCK_NAMESPACE_MOVIMIENTO_PROCESO } from '../../../shared/advisory-locks.js'
import type { MovimientoCreateInput, MovimientoDetalleInput, MovimientoListFilters, MovimientoUpdateInput } from './movimientos.types.js'

const includeDetalle = {
  tipoMovimiento: {
    select: {
      id: true, codigo: true, descripcion: true, clase: true, emiteDTE: true,
      requierePrecio: true, entidadRelacionada: true, activo: true, modulos: true,
    },
  },
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
    eliminadoEn: null,
    ...(filters.tipoMovimientoId ? { tipoMovimientoId: filters.tipoMovimientoId } : {}),
    ...(filters.estado ? { estado: filters.estado } : {}),
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
  return prisma.movimiento.findFirst({ where: { id, eliminadoEn: null }, include: includeDetalle })
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

// ─── Cabecera: crear / editar / eliminar (borrador) ──────────────────────────

export async function createMovimientoBorrador(data: MovimientoCreateInput, userId: string) {
  return prisma.movimiento.create({
    data: {
      // empresaId: la extensión de tenancy (prisma-tenancy.ts) sobrescribe
      // este valor con la empresa activa del contexto.
      empresaId: getEmpresaIdActual()!,
      tipoMovimientoId: data.tipoMovimientoId,
      fechaMovimiento: new Date(data.fechaMovimiento),
      usuarioId: userId,
    },
    include: includeDetalle,
  })
}

// Re-verifica bajo lock que el movimiento siga existiendo y en BORRADOR —
// serializa contra `confirmarMovimientoTransaccional` y contra sí misma
// (mismo motivo que `lockYVerificarEditable` en ordenes-compra.repository.ts):
// sin esto, una edición de línea concurrente con un "confirmar" podría
// aplicar el motor de PMP sobre un detalle a medio escribir.
async function lockYVerificarBorrador(tx: Tx, movimientoId: number): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_NAMESPACE_MOVIMIENTO_PROCESO}::int, ${movimientoId}::int)`
  const actual = await tx.movimiento.findFirst({ where: { id: movimientoId, eliminadoEn: null }, select: { estado: true } })
  if (!actual) throw new ValidationError('El movimiento ya no existe')
  if (actual.estado !== 'BORRADOR') throw new ValidationError('El movimiento ya fue confirmado y no puede editarse')
}

export async function updateMovimientoHeader(id: number, data: MovimientoUpdateInput) {
  const { fechaMovimiento, horaSalida, horaEstimadaLlegada, ...resto } = data
  return prisma.$transaction(async (tx) => {
    await lockYVerificarBorrador(tx, id)
    return tx.movimiento.update({
      where: { id },
      data: {
        ...resto,
        ...(fechaMovimiento !== undefined ? { fechaMovimiento: new Date(fechaMovimiento) } : {}),
        ...(horaSalida !== undefined ? { horaSalida: horaSalida ? new Date(horaSalida) : null } : {}),
        ...(horaEstimadaLlegada !== undefined
          ? { horaEstimadaLlegada: horaEstimadaLlegada ? new Date(horaEstimadaLlegada) : null }
          : {}),
      },
      include: includeDetalle,
    })
  })
}

export async function softDeleteMovimiento(id: number, eliminadoPor: string) {
  await prisma.$transaction(async (tx) => {
    await lockYVerificarBorrador(tx, id)
    await tx.movimiento.update({ where: { id }, data: { eliminadoEn: new Date(), eliminadoPor } })
  })
}

// ─── Detalle: CRUD de líneas (sin efecto en SaldoArticulo — eso ocurre solo
// al confirmar) ───────────────────────────────────────────────────────────────

const detalleSelect = {
  include: { articulo: { select: { id: true, codigo: true, descripcion: true } } },
} satisfies { include: Prisma.MovimientoDetalleInclude }

export async function addLineaDetalle(movimientoId: number, data: MovimientoDetalleInput) {
  return prisma.$transaction(async (tx) => {
    await lockYVerificarBorrador(tx, movimientoId)
    return tx.movimientoDetalle.create({
      data: { movimientoId, articuloId: data.articuloId, cantidad: data.cantidad, precioUnitario: data.precioUnitario ?? null },
      ...detalleSelect,
    })
  })
}

export async function getLineaDetalleById(detalleId: number) {
  return prisma.movimientoDetalle.findUnique({ where: { id: detalleId } })
}

export async function updateLineaDetalle(movimientoId: number, detalleId: number, data: MovimientoDetalleInput) {
  return prisma.$transaction(async (tx) => {
    await lockYVerificarBorrador(tx, movimientoId)
    return tx.movimientoDetalle.update({
      where: { id: detalleId },
      data: { articuloId: data.articuloId, cantidad: data.cantidad, precioUnitario: data.precioUnitario ?? null },
      ...detalleSelect,
    })
  })
}

export async function removeLineaDetalle(movimientoId: number, detalleId: number) {
  await prisma.$transaction(async (tx) => {
    await lockYVerificarBorrador(tx, movimientoId)
    await tx.movimientoDetalle.delete({ where: { id: detalleId } })
  })
}

// ─── Motor transaccional (R1-R14) — se dispara una sola vez, al confirmar ───

type Tx = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

// Lock por fila de SaldoArticulo (MOV-001, QA ronda 1): el advisory lock de
// confirmarMovimientoTransaccional solo serializa por movimientoId — dos
// movimientos DISTINTOS que afectan el mismo (articuloId, bodegaId) no se
// bloqueaban entre sí, así que ambos podían leer el mismo saldo antes de que
// cualquiera escribiera (lost update). Se usa la forma de 1 argumento bigint
// de pg_advisory_xact_lock (espacio de locks separado del que usa la forma de
// 2 argumentos int,int — LOCK_NAMESPACE_*), combinando ambos ids en un bigint
// para no colisionar entre pares (articuloId, bodegaId) distintos.
async function lockSaldoArticulo(tx: Tx, articuloId: number, bodegaId: number): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock((${articuloId}::bigint << 32) | ${bodegaId}::bigint)`
}

async function getOrCreateSaldo(tx: Tx, articuloId: number, bodegaId: number) {
  await lockSaldoArticulo(tx, articuloId, bodegaId)
  const existente = await tx.saldoArticulo.findUnique({
    where: { articuloId_bodegaId: { articuloId, bodegaId } },
  })
  if (existente) return existente
  return tx.saldoArticulo.create({
    data: { empresaId: getEmpresaIdActual()!, articuloId, bodegaId, cantidad: 0, costoPromedio: 0 },
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

// MOV-003 (QA ronda 2): las validaciones que corrían en el service ANTES de
// entrar a la transacción eran solo un pre-check amigable — entre esa lectura
// y la adquisición del lock, otro request podía mutar la cabecera/líneas
// (o desactivar la entidad/transportista) y la confirmación aplicaba el
// efecto sobre ese estado nuevo sin volver a validarlo. Autoridad real: TODO
// se revalida acá, después del lock, contra lo recién releído — el service
// solo conserva una copia liviana como UX (no bloqueada).
async function validarParaConfirmar(tx: Tx, movimiento: {
  bodegaOrigenId: number | null
  bodegaDestinoId: number | null
  entidadId: number | null
  transporteEntidadId: number | null
  choferRut: string | null
  choferNombre: string | null
  placaCamion: string | null
  horaSalida: Date | null
  detalle: { articuloId: number; precioUnitario: Prisma.Decimal | null }[]
}, tipoMovimiento: {
  activo: boolean
  modulos: string[]
  clase: string
  requierePrecio: boolean
  emiteDTE: boolean
  entidadRelacionada: Prisma.TipoMovimientoGetPayload<{ select: { entidadRelacionada: true } }>['entidadRelacionada']
}): Promise<Map<number, { controlaStock: boolean }>> {
  if (!tipoMovimiento.activo) {
    throw new ValidationError('El tipo de movimiento fue desactivado — no se puede confirmar')
  }
  if (!tipoMovimiento.modulos.includes('MATERIALES')) {
    throw new ValidationError('Este tipo de movimiento no aplica al módulo Materiales (R14)')
  }

  const clase = tipoMovimiento.clase
  if (clase === 'ENTRADA' && !movimiento.bodegaDestinoId) {
    throw new ValidationError('Un movimiento de Entrada requiere bodega de destino (R11)')
  }
  if (clase === 'SALIDA' && !movimiento.bodegaOrigenId) {
    throw new ValidationError('Un movimiento de Salida requiere bodega de origen (R11)')
  }
  if (clase === 'TRASLADO' && (!movimiento.bodegaOrigenId || !movimiento.bodegaDestinoId)) {
    throw new ValidationError('Un movimiento de Traslado requiere bodega de origen y destino (R11)')
  }
  if (clase === 'TRASLADO' && movimiento.bodegaOrigenId === movimiento.bodegaDestinoId) {
    throw new ValidationError('Un movimiento de Traslado no puede tener la misma bodega de origen y destino (R11)')
  }

  if (movimiento.detalle.length === 0) {
    throw new ValidationError('El movimiento debe tener al menos una línea antes de confirmar')
  }
  if (tipoMovimiento.requierePrecio && movimiento.detalle.some((d) => d.precioUnitario == null)) {
    throw new ValidationError('Este tipo de movimiento exige precio unitario en todas las líneas (R9)')
  }

  if (tipoMovimiento.emiteDTE) {
    const faltantes: string[] = []
    if (!movimiento.transporteEntidadId) faltantes.push('empresa de transporte')
    if (!movimiento.choferRut) faltantes.push('RUT del chofer')
    if (!movimiento.choferNombre) faltantes.push('nombre del chofer')
    if (!movimiento.placaCamion) faltantes.push('placa del camión')
    if (!movimiento.horaSalida) faltantes.push('hora de salida')
    if (faltantes.length > 0) {
      throw new ValidationError(`Este tipo de movimiento emite DTE y requiere: ${faltantes.join(', ')} (R10)`)
    }
    const transportista = await tx.entidad.findFirst({ where: { id: movimiento.transporteEntidadId!, eliminadoEn: null, activo: true } })
    if (!transportista) throw new ValidationError('La empresa de transporte no existe o está inactiva (R10)')
    if (!transportista.tipos.includes('EMPRESA_TRANSPORTE')) {
      throw new ValidationError('La entidad de transporte debe tener el tipo Empresa de Transporte (R10)')
    }
  }

  if (tipoMovimiento.entidadRelacionada) {
    if (!movimiento.entidadId) {
      throw new ValidationError(`Este tipo de movimiento exige una entidad de tipo ${tipoMovimiento.entidadRelacionada} (R12)`)
    }
    const entidad = await tx.entidad.findFirst({ where: { id: movimiento.entidadId, eliminadoEn: null, activo: true } })
    if (!entidad) throw new ValidationError('La entidad seleccionada no existe o está inactiva (R12)')
    if (!entidad.tipos.includes(tipoMovimiento.entidadRelacionada)) {
      throw new ValidationError(`La entidad seleccionada no tiene el tipo ${tipoMovimiento.entidadRelacionada} requerido (R12)`)
    }
  }

  const articuloIds = [...new Set(movimiento.detalle.map((d) => d.articuloId))]
  const articulos = await tx.articulo.findMany({
    where: { id: { in: articuloIds } },
    select: { id: true, controlaStock: true, activo: true },
  })
  if (articulos.length !== articuloIds.length) {
    throw new ValidationError('Uno o más artículos del movimiento no existen')
  }
  const inactivos = articulos.filter((a) => !a.activo)
  if (inactivos.length > 0) {
    throw new ValidationError(`Artículos inactivos en el movimiento: ${inactivos.map((a) => a.id).join(', ')}`)
  }
  return new Map(articulos.map((a) => [a.id, { controlaStock: a.controlaStock }]))
}

/**
 * Relee el movimiento (cabecera + detalle) bajo un advisory lock, revalida
 * TODO (R2/R9/R10/R11/R12/R14 — MOV-003, QA ronda 2) contra ese estado recién
 * leído, aplica el efecto de PMP/saldo línea por línea y deja el movimiento
 * `CONFIRMADO`. Si algún SALIDA/TRASLADO deja saldo negativo (R2) o cualquier
 * validación falla, la transacción completa hace rollback y el movimiento
 * permanece `BORRADOR` (CA19).
 */
export async function confirmarMovimientoTransaccional(movimientoId: number) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_NAMESPACE_MOVIMIENTO_PROCESO}::int, ${movimientoId}::int)`

    const movimiento = await tx.movimiento.findFirst({
      where: { id: movimientoId, eliminadoEn: null },
      include: { detalle: true },
    })
    if (!movimiento) throw new ValidationError('El movimiento ya no existe')
    if (movimiento.estado !== 'BORRADOR') throw new ValidationError('El movimiento ya fue confirmado')

    const tipoMovimiento = await tx.tipoMovimiento.findUniqueOrThrow({ where: { id: movimiento.tipoMovimientoId } })
    const clase = tipoMovimiento.clase

    const articulosPorId = await validarParaConfirmar(tx, movimiento, tipoMovimiento)

    for (const linea of movimiento.detalle) {
      const articulo = articulosPorId.get(linea.articuloId)
      if (!articulo?.controlaStock) continue // R8: sin control de stock, no genera saldo

      const cantidad = Number(linea.cantidad)
      const precioUnitario = linea.precioUnitario != null ? Number(linea.precioUnitario) : null

      if (clase === 'ENTRADA') {
        const saldo = await getOrCreateSaldo(tx, linea.articuloId, movimiento.bodegaDestinoId!)
        const cantidadActual = Number(saldo.cantidad)
        const pmpActual = Number(saldo.costoPromedio)
        const nuevaCantidad = cantidadActual + cantidad
        // R5: recalcula PMP solo si viene precio (requierePrecio ya validado en service)
        const nuevoPmp = precioUnitario != null
          ? (cantidadActual * pmpActual + cantidad * precioUnitario) / nuevaCantidad
          : pmpActual
        await tx.saldoArticulo.update({
          where: { articuloId_bodegaId: { articuloId: linea.articuloId, bodegaId: movimiento.bodegaDestinoId! } },
          data: { cantidad: nuevaCantidad, costoPromedio: nuevoPmp },
        })
      } else if (clase === 'SALIDA') {
        const saldo = await getOrCreateSaldo(tx, linea.articuloId, movimiento.bodegaOrigenId!)
        const cantidadActual = Number(saldo.cantidad)
        if (cantidadActual < cantidad) {
          throw new StockInsuficienteError(linea.articuloId, movimiento.bodegaOrigenId!, cantidadActual, cantidad)
        }
        // R6: la salida se valoriza al PMP vigente pero no lo modifica
        await tx.saldoArticulo.update({
          where: { articuloId_bodegaId: { articuloId: linea.articuloId, bodegaId: movimiento.bodegaOrigenId! } },
          data: { cantidad: cantidadActual - cantidad },
        })
      } else {
        // TRASLADO: R6 — el PMP viaja con la cantidad al destino
        const saldoOrigen = await getOrCreateSaldo(tx, linea.articuloId, movimiento.bodegaOrigenId!)
        const cantidadOrigen = Number(saldoOrigen.cantidad)
        if (cantidadOrigen < cantidad) {
          throw new StockInsuficienteError(linea.articuloId, movimiento.bodegaOrigenId!, cantidadOrigen, cantidad)
        }
        const pmpOrigen = Number(saldoOrigen.costoPromedio)

        const saldoDestino = await getOrCreateSaldo(tx, linea.articuloId, movimiento.bodegaDestinoId!)
        const cantidadDestino = Number(saldoDestino.cantidad)
        const pmpDestino = Number(saldoDestino.costoPromedio)
        const nuevaCantidadDestino = cantidadDestino + cantidad
        const nuevoPmpDestino = (cantidadDestino * pmpDestino + cantidad * pmpOrigen) / nuevaCantidadDestino

        await tx.saldoArticulo.update({
          where: { articuloId_bodegaId: { articuloId: linea.articuloId, bodegaId: movimiento.bodegaOrigenId! } },
          data: { cantidad: cantidadOrigen - cantidad },
        })
        await tx.saldoArticulo.update({
          where: { articuloId_bodegaId: { articuloId: linea.articuloId, bodegaId: movimiento.bodegaDestinoId! } },
          data: { cantidad: nuevaCantidadDestino, costoPromedio: nuevoPmpDestino },
        })
      }
    }

    return tx.movimiento.update({
      where: { id: movimientoId },
      data: { estado: 'CONFIRMADO' },
      include: includeDetalle,
    })
  })
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
