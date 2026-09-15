import { prisma } from '../../../lib/prisma.js'
import { getEmpresaIdActual } from '../../../lib/empresa-context.js'
import type {
  CajasPorPalletCreateInput,
  CajasPorPalletUpdateInput,
  CajasPorPalletListFilters,
} from './cajas-por-pallet.types.js'

const includeRefs = {
  articulo: { select: { id: true, codigo: true, descripcion: true } },
  tipoPallet: { select: { id: true, codigo: true, descripcion: true } },
}

export async function list(filters: CajasPorPalletListFilters) {
  const { page = 1, limit = 20, articuloId, tipoPalletId } = filters
  const where = {
    eliminadoEn: null,
    ...(articuloId ? { articuloId } : {}),
    ...(tipoPalletId ? { tipoPalletId } : {}),
  }
  const [data, total] = await Promise.all([
    prisma.cajasPorPallet.findMany({
      where,
      include: includeRefs,
      orderBy: [{ articuloId: 'asc' }, { tipoPalletId: 'asc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.cajasPorPallet.count({ where }),
  ])
  return { data, total }
}

export async function getById(id: number) {
  return prisma.cajasPorPallet.findFirst({ where: { id, eliminadoEn: null }, include: includeRefs })
}

export async function findByPar(articuloId: number, tipoPalletId: number, excludeId?: number) {
  return prisma.cajasPorPallet.findFirst({
    where: {
      articuloId,
      tipoPalletId,
      eliminadoEn: null,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
  })
}

export async function create(data: CajasPorPalletCreateInput, creadoPor: string) {
  // empresaId lo sobreescribe la extensión de tenancy; se declara para el tipo.
  return prisma.cajasPorPallet.create({
    data: { empresaId: getEmpresaIdActual()!, ...data, creadoPor },
    include: includeRefs,
  })
}

export async function update(id: number, data: CajasPorPalletUpdateInput, actualizadoPor: string) {
  return prisma.cajasPorPallet.update({
    where: { id },
    data: { ...data, actualizadoPor },
    include: includeRefs,
  })
}

export async function softDelete(id: number, eliminadoPor: string) {
  return prisma.cajasPorPallet.update({
    where: { id },
    data: { eliminadoEn: new Date(), eliminadoPor },
  })
}

/** Upsert por par (para la carga masiva): crea o actualiza la cifra. */
export async function upsertPorPar(articuloId: number, tipoPalletId: number, cajasPorPallet: number, userId: string) {
  const existente = await findByPar(articuloId, tipoPalletId)
  if (existente) {
    return prisma.cajasPorPallet.update({
      where: { id: existente.id },
      data: { cajasPorPallet, actualizadoPor: userId },
    })
  }
  return prisma.cajasPorPallet.create({
    data: { empresaId: getEmpresaIdActual()!, articuloId, tipoPalletId, cajasPorPallet, creadoPor: userId },
  })
}

export async function getArticulo(articuloId: number) {
  return prisma.articulo.findFirst({ where: { id: articuloId }, select: { id: true, tipo: true } })
}

export async function getTipoPallet(tipoPalletId: number) {
  return prisma.tipoPallet.findFirst({ where: { id: tipoPalletId, eliminadoEn: null }, select: { id: true } })
}
