import { prisma } from '../../../lib/prisma.js'
import type { CondicionPagoCreateInput, CondicionPagoUpdateInput } from './condiciones-pago.types.js'

const includeCuotas = {
  cuotas: {
    orderBy: { plazoDias: 'asc' as const },
    include: {
      moneda: { select: { id: true, codigo: true, descripcion: true } },
      unidad: { select: { id: true, codigo: true, descripcion: true } },
    },
  },
}

export async function listCondicionesPago(q?: string) {
  return prisma.condicionPago.findMany({
    where: {
      eliminadoEn: null,
      ...(q
        ? {
            OR: [
              { codigo: { contains: q, mode: 'insensitive' as const } },
              { descripcion: { contains: q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    },
    include: includeCuotas,
    orderBy: { codigo: 'asc' },
  })
}

export async function getCondicionPagoById(id: number) {
  return prisma.condicionPago.findFirst({
    where: { id, eliminadoEn: null },
    include: includeCuotas,
  })
}

export async function findCondicionPagoByCodigo(codigo: string) {
  return prisma.condicionPago.findFirst({ where: { codigo, eliminadoEn: null } })
}

export async function createCondicionPago(data: CondicionPagoCreateInput, creadoPor: string) {
  const { cuotas, ...cabecera } = data
  return prisma.condicionPago.create({
    data: {
      ...cabecera,
      creadoPor,
      cuotas: { create: cuotas },
    },
    include: includeCuotas,
  })
}

export async function updateCondicionPago(id: number, data: CondicionPagoUpdateInput, actualizadoPor: string) {
  const { cuotas, ...cabecera } = data
  return prisma.$transaction(async (tx) => {
    if (cuotas !== undefined) {
      await tx.condicionPagoCuota.deleteMany({ where: { condicionPagoId: id } })
      await tx.condicionPagoCuota.createMany({ data: cuotas.map((c) => ({ condicionPagoId: id, ...c })) })
    }
    return tx.condicionPago.update({
      where: { id },
      data: { ...cabecera, actualizadoPor },
      include: includeCuotas,
    })
  })
}

export async function softDeleteCondicionPago(id: number, eliminadoPor: string) {
  return prisma.condicionPago.update({
    where: { id },
    data: { eliminadoEn: new Date(), eliminadoPor },
  })
}

export async function getMoneda(id: number) {
  return prisma.moneda.findFirst({ where: { id, eliminadoEn: null, bloqueado: false }, select: { id: true } })
}

export async function getUnidadMedida(id: number) {
  return prisma.unidadMedida.findFirst({ where: { id, eliminadoEn: null, bloqueado: false }, select: { id: true, codigo: true } })
}
