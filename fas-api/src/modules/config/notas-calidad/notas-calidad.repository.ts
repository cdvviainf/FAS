import { prisma } from '../../../lib/prisma.js'
import { getEmpresaIdActual } from '../../../lib/empresa-context.js'
import type { NotaCalidadCreateInput, NotaCalidadUpdateInput } from './notas-calidad.types.js'

const includeEspecies = {
  especies: {
    include: { especie: { select: { id: true, codigo: true, descripcion: true } } },
  },
}

export async function listNotasCalidad() {
  return prisma.notaCalidad.findMany({
    where: { eliminadoEn: null },
    include: includeEspecies,
    orderBy: { codigo: 'asc' },
  })
}

export async function getNotaCalidadById(id: number) {
  return prisma.notaCalidad.findFirst({
    where: { id, eliminadoEn: null },
    include: includeEspecies,
  })
}

export async function findNotaCalidadByCodigo(codigo: string) {
  return prisma.notaCalidad.findFirst({ where: { codigo, eliminadoEn: null } })
}

export async function getEspeciesPorIds(ids: number[]) {
  return prisma.especie.findMany({ where: { id: { in: ids }, eliminadoEn: null }, select: { id: true } })
}

export async function createNotaCalidad(data: NotaCalidadCreateInput, creadoPor: string) {
  const { especieIds, ...cabecera } = data
  return prisma.notaCalidad.create({
    data: {
      // empresaId: la extensión de tenancy (prisma-tenancy.ts) sobrescribe
      // este valor con la empresa activa del contexto — se declara aquí solo
      // para satisfacer el tipo requerido por Prisma.
      empresaId: getEmpresaIdActual()!,
      ...cabecera,
      creadoPor,
      especies: { create: especieIds.map((especieId) => ({ especieId })) },
    },
    include: includeEspecies,
  })
}

export async function updateNotaCalidad(id: number, data: NotaCalidadUpdateInput, actualizadoPor: string) {
  const { especieIds, ...cabecera } = data
  return prisma.$transaction(async (tx) => {
    if (especieIds !== undefined) {
      await tx.notaCalidadEspecie.deleteMany({ where: { notaCalidadId: id } })
      if (especieIds.length > 0) {
        await tx.notaCalidadEspecie.createMany({
          data: especieIds.map((especieId) => ({ notaCalidadId: id, especieId })),
        })
      }
    }
    return tx.notaCalidad.update({
      where: { id },
      data: { ...cabecera, actualizadoPor },
      include: includeEspecies,
    })
  })
}

export async function softDeleteNotaCalidad(id: number, eliminadoPor: string) {
  return prisma.notaCalidad.update({
    where: { id },
    data: { eliminadoEn: new Date(), eliminadoPor },
  })
}

// Pallet no tiene soft-delete propio — cualquier fila existente es vigente.
export async function countPalletsConNota(id: number) {
  return prisma.pallet.count({ where: { notaCalidadId: id } })
}

export async function countSolicitudesConNota(id: number) {
  return prisma.solicitudInspeccion.count({ where: { notaCalidadId: id, eliminadoEn: null } })
}
