import { prisma } from '../../../lib/prisma.js'
import { getEmpresaIdActual } from '../../../lib/empresa-context.js'
import type { NotaCondicionCreateInput, NotaCondicionUpdateInput } from './notas-condicion.types.js'

const includeEspecies = {
  especies: {
    include: { especie: { select: { id: true, codigo: true, descripcion: true } } },
  },
}

export async function listNotasCondicion() {
  return prisma.notaCondicion.findMany({
    where: { eliminadoEn: null },
    include: includeEspecies,
    orderBy: { codigo: 'asc' },
  })
}

export async function getNotaCondicionById(id: number) {
  return prisma.notaCondicion.findFirst({
    where: { id, eliminadoEn: null },
    include: includeEspecies,
  })
}

export async function findNotaCondicionByCodigo(codigo: string) {
  return prisma.notaCondicion.findFirst({ where: { codigo, eliminadoEn: null } })
}

export async function getEspeciesPorIds(ids: number[]) {
  return prisma.especie.findMany({ where: { id: { in: ids }, eliminadoEn: null }, select: { id: true } })
}

export async function createNotaCondicion(data: NotaCondicionCreateInput, creadoPor: string) {
  const { especieIds, ...cabecera } = data
  return prisma.notaCondicion.create({
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

export async function updateNotaCondicion(id: number, data: NotaCondicionUpdateInput, actualizadoPor: string) {
  const { especieIds, ...cabecera } = data
  return prisma.$transaction(async (tx) => {
    if (especieIds !== undefined) {
      await tx.notaCondicionEspecie.deleteMany({ where: { notaCondicionId: id } })
      if (especieIds.length > 0) {
        await tx.notaCondicionEspecie.createMany({
          data: especieIds.map((especieId) => ({ notaCondicionId: id, especieId })),
        })
      }
    }
    return tx.notaCondicion.update({
      where: { id },
      data: { ...cabecera, actualizadoPor },
      include: includeEspecies,
    })
  })
}

export async function softDeleteNotaCondicion(id: number, eliminadoPor: string) {
  return prisma.notaCondicion.update({
    where: { id },
    data: { eliminadoEn: new Date(), eliminadoPor },
  })
}
