import { prisma } from '../../../lib/prisma.js'
import type { Prisma } from '@prisma/client'
import type { ArticuloCreateInput, ArticuloUpdateInput, ArticuloListFilters } from './articulos.types.js'

const unidadSelect = { id: true, codigo: true, descripcion: true }

function buildWhere(filters: ArticuloListFilters): Prisma.ArticuloWhereInput {
  return {
    ...(filters.tipo ? { tipo: filters.tipo } : {}),
    ...(filters.activo !== undefined ? { activo: filters.activo } : {}),
    ...(filters.q
      ? {
          OR: [
            { codigo: { contains: filters.q, mode: 'insensitive' as const } },
            { descripcion: { contains: filters.q, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  }
}

export async function listArticulos(filters: ArticuloListFilters) {
  const { page = 1, limit = 20 } = filters
  const where = buildWhere(filters)
  const [data, total] = await Promise.all([
    prisma.articulo.findMany({
      where,
      include: { unidad: { select: unidadSelect } },
      orderBy: { codigo: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.articulo.count({ where }),
  ])
  return { data, total }
}

export async function getArticuloById(id: number) {
  return prisma.articulo.findUnique({
    where: { id },
    include: {
      unidad: { select: unidadSelect },
      saldos: {
        include: { bodega: { select: { id: true, codigo: true, descripcion: true } } },
      },
    },
  })
}

export async function findArticuloByCodigo(codigo: string) {
  return prisma.articulo.findUnique({ where: { codigo } })
}

// ART-04: valida que la unidad de medida exista, no esté eliminada ni bloqueada
export async function getUnidadMedidaActiva(unidadId: number) {
  return prisma.unidadMedida.findFirst({
    where: { id: unidadId, eliminadoEn: null, bloqueado: false },
  })
}

export async function createArticulo(data: ArticuloCreateInput) {
  return prisma.articulo.create({
    data,
    include: { unidad: { select: unidadSelect } },
  })
}

export async function updateArticulo(id: number, data: ArticuloUpdateInput) {
  return prisma.articulo.update({
    where: { id },
    data,
    include: { unidad: { select: unidadSelect } },
  })
}

// ─── Documentos adjuntos ─────────────────────────────────────────────────────

export async function createDocumento(
  articuloId: number,
  meta: { nombre: string; mime: string; tamano: number },
  datos: Buffer,
  subidoPor: string,
) {
  return prisma.documentoArticulo.create({
    data: {
      articuloId,
      ...meta,
      subidoPor,
      contenido: { create: { datos } },
    },
    select: { id: true, nombre: true, mime: true, tamano: true, subidoPor: true, creadoEn: true },
  })
}

export async function listDocumentos(articuloId: number) {
  return prisma.documentoArticulo.findMany({
    where: { articuloId },
    select: { id: true, nombre: true, mime: true, tamano: true, subidoPor: true, creadoEn: true },
    orderBy: { creadoEn: 'asc' },
  })
}

export async function getDocumentoMeta(articuloId: number, documentoId: number) {
  return prisma.documentoArticulo.findFirst({ where: { id: documentoId, articuloId } })
}

export async function getDocumentoContenido(documentoId: number) {
  return prisma.documentoArticuloContenido.findUnique({ where: { documentoId } })
}

export async function deleteDocumento(documentoId: number) {
  return prisma.documentoArticulo.delete({ where: { id: documentoId } })
}
