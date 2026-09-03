import { Prisma } from '@prisma/client'
import { prisma } from '../../../lib/prisma.js'
import { getEmpresaIdActual } from '../../../lib/empresa-context.js'
import { ValidationError } from '../../../shared/errors.js'
import { LOCK_NAMESPACE_ORDEN_COMPRA_MATERIAL_PROCESO } from '../../../shared/advisory-locks.js'
import type {
  OrdenCompraMaterialCreateInput,
  OrdenCompraMaterialUpdateInput,
  OrdenCompraMaterialLineaCreateInput,
  OrdenCompraMaterialLineaUpdateInput,
} from './ordenes-compra.types.js'

const entidadSelect = { id: true, codigo: true, descripcion: true, razonSocial: true }
const mantenedorSelect = { id: true, codigo: true, descripcion: true }

const includeDetalle = {
  entidadProveedor: { select: entidadSelect },
  moneda: { select: mantenedorSelect },
  formaPago: { select: mantenedorSelect },
  condicionPago: { select: { id: true, codigo: true, descripcion: true } },
  lineas: {
    include: { articulo: { select: { id: true, codigo: true, descripcion: true, unidad: { select: mantenedorSelect } } } },
    orderBy: { id: 'asc' as const },
  },
  cuotasPago: { orderBy: { id: 'asc' as const } },
  movimientos: {
    where: { eliminadoEn: null },
    select: { id: true, estado: true, fechaMovimiento: true },
  },
} satisfies Prisma.OrdenCompraMaterialInclude

export async function listOrdenesCompraMaterial(page: number, limit: number, entidadProveedorId?: number, estado?: string) {
  const where: Prisma.OrdenCompraMaterialWhereInput = {
    eliminadoEn: null,
    ...(entidadProveedorId ? { entidadProveedorId } : {}),
    ...(estado ? { estado: estado as 'BORRADOR' | 'EMITIDA' | 'RECEPCIONADA' } : {}),
  }

  const [data, total] = await Promise.all([
    prisma.ordenCompraMaterial.findMany({
      where,
      include: {
        entidadProveedor: { select: entidadSelect },
        moneda: { select: mantenedorSelect },
      },
      orderBy: { id: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.ordenCompraMaterial.count({ where }),
  ])

  return { data, total }
}

export async function getOrdenCompraMaterialById(id: number) {
  return prisma.ordenCompraMaterial.findFirst({ where: { id, eliminadoEn: null }, include: includeDetalle })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Tx = any

// R20: a diferencia de la OC de fruta (editable hasta la Recepción), acá
// BORRADOR es el único estado editable — EMITIDA ya bloquea cabecera y
// líneas (decisión de negocio, 2026-09-03, ver materiales.md R20).
async function lockYVerificarBorrador(tx: Tx, ordenCompraMaterialId: number): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_NAMESPACE_ORDEN_COMPRA_MATERIAL_PROCESO}::int, ${ordenCompraMaterialId}::int)`
  const actual = await tx.ordenCompraMaterial.findFirst({ where: { id: ordenCompraMaterialId, eliminadoEn: null }, select: { estado: true } })
  if (!actual) throw new ValidationError('La Orden de Compra de Materiales ya no existe')
  if (actual.estado !== 'BORRADOR') {
    throw new ValidationError('La Orden de Compra de Materiales ya fue emitida y no puede editarse')
  }
}

// R20 (eliminación): a diferencia de editar (solo BORRADOR), eliminar también
// admite EMITIDA — pero solo si no tiene un Movimiento activo (BORRADOR o
// CONFIRMADO, no eliminado) vinculado; RECEPCIONADA sigue bloqueada siempre
// (OCM-QA-002, ronda 1). Bajo el mismo lock que lockYVerificarBorrador para
// serializar contra la vinculación de un Movimiento (materiales/movimientos.
// repository.ts, R22).
async function lockYVerificarEliminable(tx: Tx, ordenCompraMaterialId: number): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_NAMESPACE_ORDEN_COMPRA_MATERIAL_PROCESO}::int, ${ordenCompraMaterialId}::int)`
  const actual = await tx.ordenCompraMaterial.findFirst({
    where: { id: ordenCompraMaterialId, eliminadoEn: null },
    select: { estado: true, movimientos: { where: { eliminadoEn: null }, select: { id: true } } },
  })
  if (!actual) throw new ValidationError('La Orden de Compra de Materiales ya no existe')
  if (actual.estado === 'RECEPCIONADA') {
    throw new ValidationError('La Orden de Compra de Materiales ya fue recepcionada y no puede eliminarse')
  }
  if (actual.movimientos.length > 0) {
    throw new ValidationError('La Orden de Compra de Materiales tiene un Movimiento activo vinculado y no puede eliminarse')
  }
}

// R21: solo condiciones con cuotas 100% PORCENTAJE — sin MONTO_UNITARIO
// (esa variante es específica de fruta por caja/kilo). Devuelve el snapshot
// a crear; lanza si la condición tiene alguna cuota MONTO_UNITARIO.
async function cuotasDesdeCondicionPago(tx: Tx, condicionPagoId: number | null | undefined) {
  if (!condicionPagoId) return []
  const condicionPago = await tx.condicionPago.findFirst({
    where: { id: condicionPagoId, eliminadoEn: null },
    include: { cuotas: true },
  })
  if (!condicionPago) return []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (condicionPago.cuotas.some((c: any) => c.tipoValor !== 'PORCENTAJE')) {
    throw new ValidationError('La condición de pago seleccionada tiene una cuota por unidad (caja/kilo) — no aplica a Materiales (R21)')
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return condicionPago.cuotas.map((c: any) => ({
    fechaReferencia: c.fechaReferencia,
    plazoDias: c.plazoDias,
    porcentaje: c.porcentaje,
    descripcion: c.descripcion,
  }))
}

// Numeración OCM-{AAAA}-{NNNN} (R23) — namespace propio, no coordina con
// nada más (mismo criterio que LOCK_NAMESPACE_ORDEN_COMPRA en
// compras/ordenes-compra.repository.ts, no compartido en advisory-locks.ts).
const LOCK_NAMESPACE_ORDEN_COMPRA_MATERIAL_NUMERO = 490245

export async function createOrdenCompraMaterial(data: OrdenCompraMaterialCreateInput, creadoPor: string) {
  const anio = (data.fecha ?? new Date()).getFullYear()
  const prefijo = `OCM-${anio}-`

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_NAMESPACE_ORDEN_COMPRA_MATERIAL_NUMERO}::int, ${anio}::int)`

    const total = await tx.ordenCompraMaterial.count({ where: { numero: { startsWith: prefijo } } })
    const numero = `${prefijo}${String(total + 1).padStart(4, '0')}`
    const cuotasPago = await cuotasDesdeCondicionPago(tx, data.condicionPagoId)

    return tx.ordenCompraMaterial.create({
      data: {
        // empresaId: la extensión de tenancy (prisma-tenancy.ts) sobrescribe
        // este valor con la empresa activa del contexto.
        empresaId: getEmpresaIdActual()!,
        ...data,
        numero,
        creadoPor,
        cuotasPago: { create: cuotasPago },
      },
      include: includeDetalle,
    })
  })
}

export async function updateOrdenCompraMaterial(id: number, data: OrdenCompraMaterialUpdateInput, actualizadoPor: string) {
  return prisma.$transaction(async (tx) => {
    await lockYVerificarBorrador(tx, id)
    if (data.condicionPagoId !== undefined) {
      const actual = await tx.ordenCompraMaterial.findUniqueOrThrow({ where: { id }, select: { condicionPagoId: true } })
      if (data.condicionPagoId !== actual.condicionPagoId) {
        const cuotasPago = await cuotasDesdeCondicionPago(tx, data.condicionPagoId)
        await tx.ordenCompraMaterialCuotaPago.deleteMany({ where: { ordenCompraMaterialId: id } })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await tx.ordenCompraMaterialCuotaPago.createMany({ data: cuotasPago.map((c: any) => ({ ordenCompraMaterialId: id, ...c })) })
      }
    }
    return tx.ordenCompraMaterial.update({
      where: { id },
      data: { ...data, actualizadoPor },
      include: includeDetalle,
    })
  })
}

export async function emitirOrdenCompraMaterial(id: number) {
  return prisma.$transaction(async (tx) => {
    await lockYVerificarBorrador(tx, id)
    const lineas = await tx.ordenCompraMaterialLinea.count({ where: { ordenCompraMaterialId: id } })
    if (lineas === 0) throw new ValidationError('La Orden de Compra debe tener al menos una línea para emitirse')
    return tx.ordenCompraMaterial.update({
      where: { id },
      data: { estado: 'EMITIDA' },
      include: includeDetalle,
    })
  })
}

export async function softDeleteOrdenCompraMaterial(id: number, eliminadoPor: string) {
  return prisma.$transaction(async (tx) => {
    await lockYVerificarEliminable(tx, id)
    return tx.ordenCompraMaterial.update({
      where: { id },
      data: { eliminadoEn: new Date(), eliminadoPor },
    })
  })
}

function calcularMonto(cantidad: number, precioUnitario: number): Prisma.Decimal {
  return new Prisma.Decimal(cantidad).mul(precioUnitario)
}

export async function addLinea(ordenCompraMaterialId: number, data: OrdenCompraMaterialLineaCreateInput) {
  return prisma.$transaction(async (tx) => {
    await lockYVerificarBorrador(tx, ordenCompraMaterialId)
    return tx.ordenCompraMaterialLinea.create({
      data: {
        ordenCompraMaterialId,
        articuloId: data.articuloId,
        cantidad: data.cantidad,
        precioUnitario: data.precioUnitario,
        monto: calcularMonto(data.cantidad, data.precioUnitario),
      },
      include: { articulo: { select: { id: true, codigo: true, descripcion: true } } },
    })
  })
}

export async function getLineaById(id: number) {
  return prisma.ordenCompraMaterialLinea.findUnique({ where: { id }, select: { id: true, ordenCompraMaterialId: true } })
}

export async function updateLinea(ordenCompraMaterialId: number, id: number, data: OrdenCompraMaterialLineaUpdateInput) {
  return prisma.$transaction(async (tx) => {
    await lockYVerificarBorrador(tx, ordenCompraMaterialId)
    return tx.ordenCompraMaterialLinea.update({
      where: { id },
      data: {
        articuloId: data.articuloId,
        cantidad: data.cantidad,
        precioUnitario: data.precioUnitario,
        monto: calcularMonto(data.cantidad, data.precioUnitario),
      },
      include: { articulo: { select: { id: true, codigo: true, descripcion: true } } },
    })
  })
}

export async function removeLinea(id: number, ordenCompraMaterialId: number) {
  return prisma.$transaction(async (tx) => {
    await lockYVerificarBorrador(tx, ordenCompraMaterialId)
    await tx.ordenCompraMaterialLinea.delete({ where: { id } })
  })
}

// ─── Validación de referencias ───────────────────────────────────────────────

export async function getEntidadProveedor(id: number) {
  return prisma.entidad.findFirst({ where: { id, eliminadoEn: null, activo: true }, select: { id: true, tipos: true } })
}

export async function getMoneda(id: number) {
  return prisma.moneda.findFirst({ where: { id, eliminadoEn: null, bloqueado: false }, select: { id: true } })
}

export async function getFormaPago(id: number) {
  return prisma.formaPago.findFirst({ where: { id, eliminadoEn: null, bloqueado: false }, select: { id: true } })
}

export async function getCondicionPago(id: number) {
  return prisma.condicionPago.findFirst({ where: { id, eliminadoEn: null, bloqueado: false }, select: { id: true, tipo: true } })
}

export async function getArticuloActivo(id: number) {
  return prisma.articulo.findFirst({ where: { id, activo: true }, select: { id: true } })
}
