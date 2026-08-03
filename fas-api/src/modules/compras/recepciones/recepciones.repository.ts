import { prisma } from '../../../lib/prisma.js'
import { getEmpresaIdActual } from '../../../lib/empresa-context.js'
import type { RecepcionCreateInput, RecepcionUpdateInput } from './recepciones.types.js'

const entidadSelect = { id: true, codigo: true, descripcion: true, razonSocial: true }
const direccionSelect = { id: true, codigo: true, descripcion: true, direccion: true }
const mantenedorSelect = { id: true, codigo: true, descripcion: true }

const includeDetalle = {
  ordenCompra: { select: { id: true, numero: true, estado: true } },
  planta: { select: entidadSelect },
  direccionPlanta: { select: direccionSelect },
  templateCarga: { select: mantenedorSelect },
  adjuntos: {
    select: { id: true, nombre: true, mime: true, tamano: true, subidoEn: true, subidoPor: true },
    orderBy: { subidoEn: 'desc' as const },
  },
}

// Namespace de advisory lock distinto al de OrdenCompra (490236) y NotaVenta
// (490234) — evita colisiones de correlativo entre módulos.
const LOCK_NAMESPACE_RECEPCION = 490237

export async function listRecepciones(page: number, limit: number, plantaId?: number, origen?: string, estado?: string) {
  const where = {
    eliminadoEn: null,
    ...(plantaId ? { plantaId } : {}),
    ...(origen ? { origen: origen as 'COMPRA' | 'CONSIGNACION' } : {}),
    ...(estado ? { estado: estado as 'CARGADA' | 'VALIDADA' | 'RECHAZADA' } : {}),
  }

  const [data, total] = await Promise.all([
    prisma.recepcion.findMany({
      where,
      include: {
        ordenCompra: { select: { id: true, numero: true } },
        planta: { select: entidadSelect },
      },
      orderBy: { id: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.recepcion.count({ where }),
  ])

  return { data, total }
}

export async function getRecepcionById(id: number) {
  return prisma.recepcion.findFirst({ where: { id, eliminadoEn: null }, include: includeDetalle })
}

export async function createRecepcion(data: RecepcionCreateInput, creadoPor: string) {
  const anio = new Date().getFullYear()
  const prefijo = `RC-${anio}-`
  const { ordenCompraId, ...resto } = data

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_NAMESPACE_RECEPCION}::int, ${anio}::int)`

    const total = await tx.recepcion.count({ where: { numero: { startsWith: prefijo } } })
    const numero = `${prefijo}${String(total + 1).padStart(4, '0')}`

    return tx.recepcion.create({
      data: {
        // empresaId: la extensión de tenancy (prisma-tenancy.ts) sobrescribe
        // este valor con la empresa activa del contexto — se declara aquí
        // solo para satisfacer el tipo requerido por Prisma.
        empresaId: getEmpresaIdActual()!,
        ...resto,
        ordenCompraId: ordenCompraId ?? null,
        origen: ordenCompraId ? 'COMPRA' : 'CONSIGNACION',
        numero,
        creadoPor,
      },
      include: includeDetalle,
    })
  })
}

export async function updateRecepcion(id: number, data: RecepcionUpdateInput, actualizadoPor: string) {
  return prisma.recepcion.update({
    where: { id },
    data: { ...data, actualizadoPor },
    include: includeDetalle,
  })
}

export async function softDeleteRecepcion(id: number, eliminadoPor: string) {
  return prisma.recepcion.update({
    where: { id },
    data: { eliminadoEn: new Date(), eliminadoPor },
  })
}

// ─── Validación de referencias ────────────────────────────────────────────────

export async function getEntidadPlanta(id: number) {
  return prisma.entidad.findFirst({ where: { id, eliminadoEn: null }, select: { id: true, tipos: true, activo: true } })
}

export async function getDireccionDeEntidad(direccionId: number, entidadId: number) {
  return prisma.entidadDireccion.findFirst({ where: { id: direccionId, entidadId, eliminadoEn: null } })
}

export async function getOrdenCompra(id: number) {
  return prisma.ordenCompra.findFirst({
    where: { id, eliminadoEn: null },
    select: { id: true, estado: true },
  })
}

// Ignora Recepciones eliminadas (soft delete) — una OC vuelve a estar
// disponible si su única Recepción previa fue eliminada (QAR-RCT-004). Se
// consulta aparte porque Prisma no filtra relaciones 1:1 dentro de `select`.
export async function getRecepcionActivaPorOrdenCompra(ordenCompraId: number) {
  return prisma.recepcion.findFirst({ where: { ordenCompraId, eliminadoEn: null }, select: { id: true } })
}

export async function getTemplateCarga(id: number) {
  return prisma.templateCarga.findFirst({ where: { id, eliminadoEn: null } })
}

// ─── Adjuntos ──────────────────────────────────────────────────────────────

export async function createAdjunto(
  recepcionId: number,
  meta: { nombre: string; mime: string; tamano: number },
  datos: Buffer,
  subidoPor: string,
) {
  return prisma.recepcionAdjunto.create({
    data: { recepcionId, ...meta, subidoPor, contenido: { create: { datos } } },
    select: { id: true, nombre: true, mime: true, tamano: true, subidoEn: true, subidoPor: true },
  })
}

export async function getAdjuntoMeta(recepcionId: number, adjuntoId: number) {
  return prisma.recepcionAdjunto.findFirst({ where: { id: adjuntoId, recepcionId } })
}

export async function getAdjuntoContenido(adjuntoId: number) {
  return prisma.recepcionAdjuntoContenido.findUnique({ where: { adjuntoId } })
}

export async function deleteAdjunto(adjuntoId: number) {
  return prisma.recepcionAdjunto.delete({ where: { id: adjuntoId } })
}
