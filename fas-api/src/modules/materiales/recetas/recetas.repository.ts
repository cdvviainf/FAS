import { prisma } from '../../../lib/prisma.js'
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

export async function getRecetaById(id: number) {
  return prisma.receta.findUnique({ where: { id }, include: includeDetalle })
}

export async function findRecetaByCodigo(codigo: string) {
  return prisma.receta.findUnique({ where: { codigo } })
}

export async function createReceta(data: RecetaCreateInput) {
  const { detalle, ...cabecera } = data
  return prisma.receta.create({
    data: {
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
