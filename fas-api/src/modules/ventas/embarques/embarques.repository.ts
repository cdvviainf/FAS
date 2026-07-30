import { prisma } from '../../../lib/prisma.js'
import type { EmbarqueCreateInput } from './embarques.types.js'

const notaVentaRefSelect = { id: true, folio: true }

export async function listEmbarques(page: number, limit: number, notaVentaId?: number) {
  const where = { eliminadoEn: null, ...(notaVentaId ? { notaVentaId } : {}) }
  const [data, total] = await Promise.all([
    prisma.embarque.findMany({
      where,
      include: { notaVenta: { select: notaVentaRefSelect } },
      orderBy: { creadoEn: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.embarque.count({ where }),
  ])
  return { data, total }
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
