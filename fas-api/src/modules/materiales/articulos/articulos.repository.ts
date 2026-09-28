import { prisma } from '../../../lib/prisma.js'
import type { Prisma } from '@prisma/client'
import { getEmpresaIdActual } from '../../../lib/empresa-context.js'
import type { ArticuloCreateInput, ArticuloUpdateInput, ArticuloListFilters } from './articulos.types.js'

const unidadSelect = { id: true, codigo: true, descripcion: true }
const etiquetaSelect = { id: true, codigo: true, descripcion: true }
const especieSelect = { id: true, codigo: true, descripcion: true }

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
      include: { unidad: { select: unidadSelect }, etiqueta: { select: etiquetaSelect }, especie: { select: especieSelect } },
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
      etiqueta: { select: etiquetaSelect },
      especie: { select: especieSelect },
      codigosEquivalentes: { select: { id: true, codigo: true, descripcion: true }, orderBy: { id: 'asc' } },
      saldos: {
        include: { bodega: { select: { id: true, codigo: true, descripcion: true } } },
      },
    },
  })
}

export async function findArticuloByCodigo(codigo: string) {
  return prisma.articulo.findFirst({ where: { codigo } })
}

// ART-04: valida que la unidad de medida exista, no esté eliminada ni bloqueada
export async function getUnidadMedidaActiva(unidadId: number) {
  return prisma.unidadMedida.findFirst({
    where: { id: unidadId, eliminadoEn: null, bloqueado: false },
  })
}

// Valida que la etiqueta exista, no esté eliminada ni bloqueada (requerida
// solo si tipo=EMBALAJE, ver articulos.service.ts).
export async function getEtiquetaActiva(etiquetaId: number) {
  return prisma.etiqueta.findFirst({
    where: { id: etiquetaId, eliminadoEn: null, bloqueado: false },
  })
}

const articuloInclude = {
  unidad: { select: unidadSelect },
  etiqueta: { select: etiquetaSelect },
  especie: { select: especieSelect },
  codigosEquivalentes: { select: { id: true, codigo: true, descripcion: true }, orderBy: { id: 'asc' as const } },
}

function nestedCodigos(codigos: ArticuloCreateInput['codigosEquivalentes']) {
  return (codigos ?? []).map((c) => ({ codigo: c.codigo, descripcion: c.descripcion ?? null }))
}

export async function createArticulo(data: ArticuloCreateInput) {
  const { codigosEquivalentes, ...scalar } = data
  return prisma.articulo.create({
    // empresaId: la extensión de tenancy (prisma-tenancy.ts) sobrescribe este
    // valor con la empresa activa del contexto — se declara aquí solo para
    // satisfacer el tipo requerido por Prisma.
    data: {
      ...scalar,
      empresaId: getEmpresaIdActual()!,
      ...(codigosEquivalentes && codigosEquivalentes.length > 0
        ? { codigosEquivalentes: { create: nestedCodigos(codigosEquivalentes) } }
        : {}),
    },
    include: articuloInclude,
  })
}

export async function updateArticulo(id: number, data: ArticuloUpdateInput) {
  const { codigosEquivalentes, ...scalar } = data
  // Si `codigosEquivalentes` viene definida, reemplaza toda la lista (borra +
  // recrea) en una transacción; si es undefined, no se toca.
  if (codigosEquivalentes !== undefined) {
    return prisma.$transaction(async (tx) => {
      await tx.articuloCodigoEquivalente.deleteMany({ where: { articuloId: id } })
      return tx.articulo.update({
        where: { id },
        data: {
          ...scalar,
          ...(codigosEquivalentes.length > 0 ? { codigosEquivalentes: { create: nestedCodigos(codigosEquivalentes) } } : {}),
        },
        include: articuloInclude,
      })
    })
  }
  return prisma.articulo.update({ where: { id }, data: scalar, include: articuloInclude })
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
