import { prisma } from '../../../lib/prisma.js'
import type { EmbarqueCreateInput } from './embarques.types.js'

const notaVentaRefSelect = { id: true, folio: true }

export async function listEmbarques(notaVentaId?: number) {
  return prisma.embarque.findMany({
    where: { eliminadoEn: null, ...(notaVentaId ? { notaVentaId } : {}) },
    include: { notaVenta: { select: notaVentaRefSelect } },
    orderBy: { creadoEn: 'desc' },
  })
}

export async function getEmbarqueById(id: number) {
  return prisma.embarque.findFirst({
    where: { id, eliminadoEn: null },
    include: { notaVenta: { select: notaVentaRefSelect } },
  })
}

export async function findByNumeroInstructivo(numeroInstructivo: string) {
  return prisma.embarque.findFirst({ where: { numeroInstructivo, eliminadoEn: null } })
}

export async function getNotaVenta(id: number) {
  return prisma.notaVenta.findFirst({ where: { id, eliminadoEn: null }, select: { id: true } })
}

export async function createEmbarque(data: EmbarqueCreateInput, creadoPor: string) {
  return prisma.embarque.create({
    data: { ...data, creadoPor },
    include: { notaVenta: { select: notaVentaRefSelect } },
  })
}
