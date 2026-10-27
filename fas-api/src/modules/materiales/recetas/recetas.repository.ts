import { Prisma } from '@prisma/client'
import { prisma } from '../../../lib/prisma.js'
import { getEmpresaIdActual } from '../../../lib/empresa-context.js'
import type { RecetaCreateInput, RecetaUpdateInput } from './recetas.types.js'

const componenteSelect = { id: true, codigo: true, descripcion: true, tipo: true }

const includeDetalle = {
  embalaje: { select: { id: true, codigo: true, descripcion: true } },
  detalle: {
    include: { componente: { select: componenteSelect } },
  },
}

export async function listRecetasPorEmbalaje(embalajeId: number) {
  return prisma.receta.findMany({
    where: { embalajeId },
    include: includeDetalle,
    orderBy: { codigo: 'asc' },
  })
}

// Listado plano de todas las recetas (tenant-scoped por la extensión Prisma),
// con búsqueda por código/descripción propia o del embalaje, y paginación.
export async function listRecetas(filters: { q?: string; page?: number; limit?: number }) {
  const { q, page = 1, limit = 20 } = filters
  const where: Prisma.RecetaWhereInput = q
    ? {
        OR: [
          { codigo: { contains: q, mode: 'insensitive' } },
          { descripcion: { contains: q, mode: 'insensitive' } },
          { embalaje: { codigo: { contains: q, mode: 'insensitive' } } },
          { embalaje: { descripcion: { contains: q, mode: 'insensitive' } } },
        ],
      }
    : {}
  const [data, total] = await Promise.all([
    prisma.receta.findMany({
      where,
      include: includeDetalle,
      orderBy: { codigo: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.receta.count({ where }),
  ])
  return { data, total }
}

export async function getRecetaById(id: number) {
  return prisma.receta.findUnique({ where: { id }, include: includeDetalle })
}

export async function findRecetaByCodigo(codigo: string) {
  return prisma.receta.findFirst({ where: { codigo } })
}

export async function createReceta(data: RecetaCreateInput) {
  const { detalle, ...cabecera } = data
  return prisma.receta.create({
    data: {
      // empresaId: la extensión de tenancy (prisma-tenancy.ts) sobrescribe
      // este valor con la empresa activa del contexto — se declara aquí solo
      // para satisfacer el tipo requerido por Prisma.
      empresaId: getEmpresaIdActual()!,
      ...cabecera,
      detalle: { create: detalle },
    },
    include: includeDetalle,
  })
}

export async function updateReceta(id: number, data: RecetaUpdateInput) {
  const { detalle, ...cabecera } = data
  return prisma.$transaction(async (tx) => {
    if (detalle !== undefined) {
      await tx.recetaDetalle.deleteMany({ where: { recetaId: id } })
      await tx.recetaDetalle.createMany({
        data: detalle.map((d) => ({ recetaId: id, ...d })),
      })
    }
    return tx.receta.update({
      where: { id },
      data: cabecera,
      include: includeDetalle,
    })
  })
}

export async function getArticuloTipo(articuloId: number) {
  return prisma.articulo.findUnique({ where: { id: articuloId }, select: { id: true, tipo: true, activo: true } })
}

export async function getArticulosTipos(ids: number[]) {
  return prisma.articulo.findMany({ where: { id: { in: ids } }, select: { id: true, tipo: true, activo: true } })
}
