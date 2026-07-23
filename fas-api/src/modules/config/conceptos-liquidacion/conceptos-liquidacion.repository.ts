import { prisma } from '../../../lib/prisma.js'
import type { ConceptoLiquidacionCreateInput, ConceptoLiquidacionUpdateInput } from './conceptos-liquidacion.types.js'

const includeValores = {
  valores: {
    include: { especie: { select: { id: true, codigo: true, descripcion: true } } },
  },
}

export async function listConceptos() {
  return prisma.conceptoLiquidacion.findMany({
    where: { eliminadoEn: null },
    include: includeValores,
    orderBy: { codigo: 'asc' },
  })
}

export async function getConceptoById(id: number) {
  return prisma.conceptoLiquidacion.findFirst({
    where: { id, eliminadoEn: null },
    include: includeValores,
  })
}

export async function findConceptoByCodigo(codigo: string) {
  return prisma.conceptoLiquidacion.findFirst({ where: { codigo, eliminadoEn: null } })
}

export async function createConcepto(data: ConceptoLiquidacionCreateInput, creadoPor: string) {
  const { valores, ...cabecera } = data
  return prisma.conceptoLiquidacion.create({
    data: {
      ...cabecera,
      creadoPor,
      valores: { create: valores },
    },
    include: includeValores,
  })
}

export async function updateConcepto(id: number, data: ConceptoLiquidacionUpdateInput, actualizadoPor: string) {
  const { valores, ...cabecera } = data
  return prisma.$transaction(async (tx) => {
    if (valores !== undefined) {
      await tx.conceptoLiquidacionEspecie.deleteMany({ where: { conceptoId: id } })
      if (valores.length > 0) {
        await tx.conceptoLiquidacionEspecie.createMany({
          data: valores.map((v) => ({ conceptoId: id, ...v })),
        })
      }
    }
    return tx.conceptoLiquidacion.update({
      where: { id },
      data: { ...cabecera, actualizadoPor },
      include: includeValores,
    })
  })
}

export async function softDeleteConcepto(id: number, eliminadoPor: string) {
  return prisma.conceptoLiquidacion.update({
    where: { id },
    data: { eliminadoEn: new Date(), eliminadoPor },
  })
}
