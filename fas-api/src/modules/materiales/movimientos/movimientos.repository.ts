import { prisma } from '../../../lib/prisma.js'
import { Prisma } from '@prisma/client'
import type { PrismaClient } from '@prisma/client'
import { getEmpresaIdActual } from '../../../lib/empresa-context.js'
import { ValidationError } from '../../../shared/errors.js'
import { LOCK_NAMESPACE_MOVIMIENTO_PROCESO, LOCK_NAMESPACE_ORDEN_COMPRA_MATERIAL_PROCESO } from '../../../shared/advisory-locks.js'
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
  // R23: permite al frontend saber si esta recepción ya fue anulada
  // (movimientoReverso != null) sin una consulta aparte.
  movimientoReverso: { select: { id: true } },
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

// materiales.md R22 — pre-check amigable (no bloqueado) desde el service;
// la autoridad real vuelve a leer esto bajo lock en
// validarYCerrarOrdenCompraMaterial (dentro de confirmarMovimientoTransaccional).
export async function getOrdenCompraMaterialActiva(id: number) {
  return prisma.ordenCompraMaterial.findFirst({
    where: { id, eliminadoEn: null },
    select: { id: true, estado: true, entidadProveedorId: true },
  })
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

// materiales.md R22 — se ejecuta DENTRO de la transacción de confirmar, bajo
// un lock propio por ordenCompraMaterialId (serializa contra el CRUD de la
// OC en materiales/ordenes-compra.repository.ts, que toma el mismo
// namespace). Revalida todo contra el estado recién leído — nada de esto se
// confía desde el pre-check del service. Devuelve el entidadId a persistir
// en el movimiento (copiado de la OC si no venía informado) y una función
// para cerrar la OC una vez que el resto de la confirmación tuvo éxito.
async function validarYCerrarOrdenCompraMaterial(
  tx: Tx,
  movimiento: { entidadId: number | null; detalle: { articuloId: number; cantidad: Prisma.Decimal }[] },
  ordenCompraMaterialId: number,
): Promise<{ entidadIdEfectivo: number | null; cerrar: () => Promise<void> }> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_NAMESPACE_ORDEN_COMPRA_MATERIAL_PROCESO}::int, ${ordenCompraMaterialId}::int)`

  const oc = await tx.ordenCompraMaterial.findFirst({
    where: { id: ordenCompraMaterialId, eliminadoEn: null },
    include: { lineas: { select: { articuloId: true, cantidad: true } } },
  })
  if (!oc) throw new ValidationError('La Orden de Compra de Materiales vinculada ya no existe (R22)')
  if (oc.estado !== 'EMITIDA') {
    throw new ValidationError('La Orden de Compra de Materiales vinculada ya no está EMITIDA (R22)')
  }
  if (movimiento.entidadId != null && movimiento.entidadId !== oc.entidadProveedorId) {
    throw new ValidationError('El proveedor del movimiento no coincide con el de la Orden de Compra de Materiales (R22)')
  }

  const cantidadPorArticuloMovimiento = new Map<number, Prisma.Decimal>()
  for (const linea of movimiento.detalle) {
    const previo = cantidadPorArticuloMovimiento.get(linea.articuloId) ?? new Prisma.Decimal(0)
    cantidadPorArticuloMovimiento.set(linea.articuloId, previo.plus(linea.cantidad))
  }
  const cantidadPorArticuloOc = new Map<number, Prisma.Decimal>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const linea of oc.lineas as any[]) {
    const previo = cantidadPorArticuloOc.get(linea.articuloId) ?? new Prisma.Decimal(0)
    cantidadPorArticuloOc.set(linea.articuloId, previo.plus(linea.cantidad))
  }
  for (const [articuloId, cantidad] of cantidadPorArticuloMovimiento) {
    const cantidadOc = cantidadPorArticuloOc.get(articuloId)
    if (!cantidadOc) {
      throw new ValidationError(`El artículo ${articuloId} del movimiento no está en la Orden de Compra de Materiales (R22)`)
    }
    if (cantidad.gt(cantidadOc)) {
      throw new ValidationError(
        `La cantidad del artículo ${articuloId} (${cantidad.toString()}) supera la cantidad de la Orden de Compra de Materiales (${cantidadOc.toString()}) (R22)`,
      )
    }
  }
  // OCM-QA-003 (ronda 1): sin recepción parcial (materiales.md R22) — el
  // Movimiento debe cubrir TODOS los artículos de la OC (cada cantidad puede
  // ser menor o igual, pero ninguna línea puede faltar por completo), o la OC
  // quedaría RECEPCIONADA con artículos nunca recibidos.
  for (const articuloId of cantidadPorArticuloOc.keys()) {
    if (!cantidadPorArticuloMovimiento.has(articuloId)) {
      throw new ValidationError(
        `El movimiento no cubre el artículo ${articuloId} de la Orden de Compra de Materiales — no hay recepción parcial (R22)`,
      )
    }
  }

  return {
    entidadIdEfectivo: movimiento.entidadId ?? oc.entidadProveedorId,
    cerrar: async () => {
      await tx.ordenCompraMaterial.update({ where: { id: ordenCompraMaterialId }, data: { estado: 'RECEPCIONADA' } })
    },
  }
}

// R6: la salida se valoriza al PMP vigente pero no lo modifica. Compartido
// entre confirmarMovimientoTransaccional (SALIDA/TRASLADO) y
// anularRecepcionTransaccional (movimiento inverso de una recepción, R23).
async function aplicarSalida(tx: Tx, articuloId: number, bodegaId: number, cantidad: number): Promise<void> {
  const saldo = await getOrCreateSaldo(tx, articuloId, bodegaId)
  const cantidadActual = Number(saldo.cantidad)
  if (cantidadActual < cantidad) {
    throw new StockInsuficienteError(articuloId, bodegaId, cantidadActual, cantidad)
  }
  await tx.saldoArticulo.update({
    where: { articuloId_bodegaId: { articuloId, bodegaId } },
    data: { cantidad: cantidadActual - cantidad },
  })
}

/**
 * Relee el movimiento (cabecera + detalle) bajo un advisory lock, revalida
 * TODO (R2/R9/R10/R11/R12/R14 — MOV-003, QA ronda 2) contra ese estado recién
 * leído, aplica el efecto de PMP/saldo línea por línea y deja el movimiento
 * `CONFIRMADO`. Si algún SALIDA/TRASLADO deja saldo negativo (R2) o cualquier
 * validación falla, la transacción completa hace rollback y el movimiento
 * permanece `BORRADOR` (CA19). Si el movimiento referencia una Orden de
 * Compra de Materiales, además revalida y cierra esa OC (R22).
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

    let cerrarOrdenCompraMaterial: (() => Promise<void>) | null = null
    if (movimiento.ordenCompraMaterialId != null) {
      const resultado = await validarYCerrarOrdenCompraMaterial(tx, movimiento, movimiento.ordenCompraMaterialId)
      movimiento.entidadId = resultado.entidadIdEfectivo
      cerrarOrdenCompraMaterial = resultado.cerrar
    }

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
        await aplicarSalida(tx, linea.articuloId, movimiento.bodegaOrigenId!, cantidad)
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

    if (cerrarOrdenCompraMaterial) await cerrarOrdenCompraMaterial()

    return tx.movimiento.update({
      where: { id: movimientoId },
      data: { estado: 'CONFIRMADO', entidadId: movimiento.entidadId },
      include: includeDetalle,
    })
  })
}

// ─── R23: anular una recepción (Movimiento CONFIRMADO vinculado a una OC) ───

// Exportado para que tipos-movimiento.service.ts bloquee su creación/edición
// manual desde el mantenedor genérico (MAT-R24-003, QA ronda 2) — es un
// registro de sistema, no un tipo de movimiento normal.
export const CODIGO_TIPO_REVERSO_RECEPCION = 'REVERSO_RECEPCION_OC'

// Uno por empresa — se crea la primera vez que se anula una recepción en esa
// empresa, no requiere que el administrador lo cree a mano en el mantenedor
// de Tipos de Movimiento (materiales.md R23).
// MAT-R24-002 (QA ronda 1): findUnique + create (no atómico) corría una
// carrera entre dos anulaciones concurrentes de OCs distintas de la misma
// empresa (ninguna toma el mismo lock por movimiento/OC) — la segunda podía
// fallar con P2002 en vez de reutilizar el tipo recién creado por la primera.
// `upsert` es una única sentencia atómica a nivel de base de datos.
//
// MAT-R24-003 (QA ronda 2): `update` restablece SIEMPRE la configuración
// canónica (no solo al crear) — el mantenedor de Tipos de Movimiento ya
// bloquea tocar este código (tipos-movimiento.service.ts), pero esto es la
// segunda capa de defensa: si de todos modos quedara un registro con datos
// incorrectos (ej. import manual a la BD), el reverso lo autocorrige antes
// de usarlo en vez de heredar una clase/módulo equivocado silenciosamente.
async function getOrCreateTipoMovimientoReverso(tx: Tx, empresaId: number) {
  const configCanonica = {
    descripcion: 'Reverso de Recepción (Orden de Compra de Materiales)',
    clase: 'SALIDA' as const,
    modulos: ['MATERIALES' as const],
    requierePrecio: false,
    emiteDTE: false,
    activo: true,
  }
  return tx.tipoMovimiento.upsert({
    where: { empresaId_codigo: { empresaId, codigo: CODIGO_TIPO_REVERSO_RECEPCION } },
    create: { empresaId, codigo: CODIGO_TIPO_REVERSO_RECEPCION, ...configCanonica },
    update: configCanonica,
  })
}

/**
 * Anula la recepción de una Orden de Compra de Materiales (materiales.md
 * R23): genera un Movimiento de SALIDA "espejo" del ENTRADA original (mismas
 * líneas/cantidades, misma bodega), lo deja CONFIRMADO de inmediato (no pasa
 * por BORRADOR — es un reverso automático, no una edición manual), y revierte
 * la OC vinculada de RECEPCIONADA a EMITIDA. El Movimiento original NUNCA se
 * toca (R1 — un CONFIRMADO es inmutable), queda intacto para el kardex. Falla
 * con StockInsuficienteError (422 vía el service) si el material ya no tiene
 * saldo suficiente para revertir (se consumió/trasladó después de recibido).
 */
export async function anularRecepcionTransaccional(movimientoOriginalId: number, userId: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_NAMESPACE_MOVIMIENTO_PROCESO}::int, ${movimientoOriginalId}::int)`

    const original = await tx.movimiento.findFirst({
      where: { id: movimientoOriginalId, eliminadoEn: null },
      include: { detalle: true, tipoMovimiento: { select: { clase: true } } },
    })
    if (!original) throw new ValidationError('El movimiento ya no existe')
    if (original.estado !== 'CONFIRMADO') throw new ValidationError('Solo se puede anular un movimiento CONFIRMADO (R23)')
    if (original.ordenCompraMaterialId == null) {
      throw new ValidationError('Solo se puede anular la recepción de un movimiento vinculado a una Orden de Compra de Materiales (R23)')
    }
    if (original.tipoMovimiento.clase !== 'ENTRADA') {
      // Defensivo: R22 ya impide vincular una OC a algo que no sea ENTRADA.
      throw new ValidationError('Solo se puede anular un movimiento de clase Entrada (R23)')
    }

    const yaAnulado = await tx.movimiento.findFirst({
      where: { movimientoInversoDeId: movimientoOriginalId, eliminadoEn: null },
      select: { id: true },
    })
    if (yaAnulado) throw new ValidationError('Este movimiento ya fue anulado (R23)')

    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_NAMESPACE_ORDEN_COMPRA_MATERIAL_PROCESO}::int, ${original.ordenCompraMaterialId}::int)`
    const oc = await tx.ordenCompraMaterial.findFirst({
      where: { id: original.ordenCompraMaterialId, eliminadoEn: null },
      select: { id: true, estado: true },
    })
    if (!oc) throw new ValidationError('La Orden de Compra de Materiales vinculada ya no existe (R23)')
    if (oc.estado !== 'RECEPCIONADA') {
      throw new ValidationError('La Orden de Compra de Materiales vinculada ya no está RECEPCIONADA (R23)')
    }

    const articuloIds = [...new Set(original.detalle.map((d) => d.articuloId))]
    const articulos = await tx.articulo.findMany({
      where: { id: { in: articuloIds } },
      select: { id: true, controlaStock: true },
    })
    const controlaStockPorArticulo = new Map(articulos.map((a) => [a.id, a.controlaStock]))

    const tipoReverso = await getOrCreateTipoMovimientoReverso(tx, original.empresaId)

    const inverso = await tx.movimiento.create({
      data: {
        empresaId: original.empresaId,
        tipoMovimientoId: tipoReverso.id,
        entidadId: original.entidadId,
        fechaMovimiento: new Date(),
        bodegaOrigenId: original.bodegaDestinoId,
        usuarioId: userId,
        estado: 'CONFIRMADO',
        movimientoInversoDeId: original.id,
        detalle: {
          create: original.detalle.map((d) => ({
            articuloId: d.articuloId,
            cantidad: d.cantidad,
            precioUnitario: d.precioUnitario,
          })),
        },
      },
      include: includeDetalle,
    })

    for (const linea of inverso.detalle) {
      if (!controlaStockPorArticulo.get(linea.articuloId)) continue // R8, igual que al confirmar
      await aplicarSalida(tx, linea.articuloId, original.bodegaDestinoId!, Number(linea.cantidad))
    }

    await tx.ordenCompraMaterial.update({ where: { id: original.ordenCompraMaterialId }, data: { estado: 'EMITIDA' } })

    return inverso
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
