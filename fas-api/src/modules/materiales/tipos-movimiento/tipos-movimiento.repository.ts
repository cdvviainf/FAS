import { prisma } from '../../../lib/prisma.js'
import type { Prisma } from '@prisma/client'
import type {
  TipoMovimientoCreateInput,
  TipoMovimientoUpdateInput,
  TipoMovimientoListFilters,
} from './tipos-movimiento.types.js'

function buildWhere(filters: TipoMovimientoListFilters): Prisma.TipoMovimientoWhereInput {
  return {
    ...(filters.modulo ? { modulos: { has: filters.modulo } } : {}),
    ...(filters.clase ? { clase: filters.clase } : {}),
    ...(filters.activo !== undefined ? { activo: filters.activo } : {}),
  }
}

export async function listTiposMovimiento(filters: TipoMovimientoListFilters) {
  const { page = 1, limit = 20 } = filters
  const where = buildWhere(filters)
  const [data, total] = await Promise.all([
    prisma.tipoMovimiento.findMany({
      where,
      orderBy: { codigo: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.tipoMovimiento.count({ where }),
  ])
  return { data, total }
}

export async function getTipoMovimientoById(id: number) {
  return prisma.tipoMovimiento.findUnique({ where: { id } })
}

export async function findTipoMovimientoByCodigo(codigo: string) {
  return prisma.tipoMovimiento.findUnique({ where: { codigo } })
}

export async function createTipoMovimiento(data: TipoMovimientoCreateInput) {
  return prisma.tipoMovimiento.create({ data })
}

export async function updateTipoMovimiento(id: number, data: TipoMovimientoUpdateInput) {
  return prisma.tipoMovimiento.update({ where: { id }, data })
}
