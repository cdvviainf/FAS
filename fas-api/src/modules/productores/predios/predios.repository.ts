import { prisma } from '../../../lib/prisma.js'
import type { PredioCreateInput, PredioUpdateInput } from './predios.types.js'

const includeRefs = {
  comuna: { select: { id: true, descripcion: true } },
  tipoProduccion: { select: { id: true, descripcion: true } },
  zona: { select: { id: true, descripcion: true } },
}

export async function listPrediosPorEntidad(entidadId: number) {
  return prisma.predio.findMany({
    where: { entidadId, eliminadoEn: null },
    include: includeRefs,
    orderBy: { codigo: 'asc' },
  })
}

export async function getPredioById(entidadId: number, predioId: number) {
  return prisma.predio.findFirst({
    where: { id: predioId, entidadId, eliminadoEn: null },
    include: includeRefs,
  })
}

export async function findPredioByCodigo(entidadId: number, codigo: string, excludeId?: number) {
  return prisma.predio.findFirst({
    where: {
      entidadId,
      codigo,
      eliminadoEn: null,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  })
}

export async function createPredio(entidadId: number, data: PredioCreateInput, creadoPor: string) {
  return prisma.predio.create({
    data: { ...data, entidadId, creadoPor },
    include: includeRefs,
  })
}

export async function updatePredio(predioId: number, data: PredioUpdateInput, actualizadoPor: string) {
  return prisma.predio.update({
    where: { id: predioId },
    data: { ...data, actualizadoPor },
    include: includeRefs,
  })
}

export async function softDeletePredio(predioId: number, eliminadoPor: string) {
  return prisma.predio.update({
    where: { id: predioId },
    data: { eliminadoEn: new Date(), eliminadoPor },
  })
}

export async function countPrediosPorEntidad(entidadId: number) {
  return prisma.predio.count({ where: { entidadId, eliminadoEn: null } })
}

// PROD-03: las FKs configurables deben apuntar a registros vigentes (no eliminados/bloqueados)
export async function getComunaActiva(id: number) {
  return prisma.comuna.findFirst({ where: { id, eliminadoEn: null, bloqueado: false } })
}

export async function getTipoProduccionActivo(id: number) {
  return prisma.tipoProduccion.findFirst({ where: { id, eliminadoEn: null, bloqueado: false } })
}

export async function getZonaActiva(id: number) {
  return prisma.zona.findFirst({ where: { id, eliminadoEn: null, bloqueado: false } })
}
