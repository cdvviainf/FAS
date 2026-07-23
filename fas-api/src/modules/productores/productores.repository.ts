import { prisma } from '../../lib/prisma.js'
import type { Prisma } from '@prisma/client'

export async function listProductores(filters: { q?: string; page?: number; limit?: number }) {
  const { page = 1, limit = 20, q } = filters
  const where: Prisma.EntidadWhereInput = {
    eliminadoEn: null,
    tipos: { has: 'PRODUCTOR' },
    ...(q
      ? {
          OR: [
            { codigo: { contains: q, mode: 'insensitive' as const } },
            { descripcion: { contains: q, mode: 'insensitive' as const } },
            { razonSocial: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  }
  const [data, total] = await Promise.all([
    prisma.entidad.findMany({
      where,
      select: { id: true, codigo: true, descripcion: true, razonSocial: true, activo: true },
      orderBy: { descripcion: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.entidad.count({ where }),
  ])
  return { data, total }
}

export async function getFicha(entidadId: number) {
  const entidad = await prisma.entidad.findFirst({
    where: { id: entidadId, eliminadoEn: null, tipos: { has: 'PRODUCTOR' } },
    include: {
      pais: { select: { id: true, descripcion: true } },
      contactos: {
        where: { eliminadoEn: null },
        orderBy: [{ esRepresentanteLegal: 'desc' }, { codigo: 'asc' }],
      },
      direcciones: { where: { eliminadoEn: null } },
      predios: { where: { eliminadoEn: null } },
      contratos: { where: { eliminadoEn: null }, orderBy: { creadoEn: 'desc' } },
    },
  })
  if (!entidad) return null
  return {
    ...entidad,
    tieneRepresentanteLegal: entidad.contactos.some((c) => c.esRepresentanteLegal),
  }
}
