import { prisma } from '../../../lib/prisma.js'
import type { Prisma } from '@prisma/client'
import type { MovimientoCCCreateInput, CuentaCorrienteFilters } from './cuenta-corriente.types.js'

const includeRefs = {
  tipo: { select: { id: true, codigo: true, descripcion: true, naturaleza: true } },
  moneda: { select: { id: true, codigo: true, descripcion: true } },
} satisfies Prisma.MovimientoCuentaCorrienteInclude

function buildWhere(entidadId: number, filters: CuentaCorrienteFilters): Prisma.MovimientoCuentaCorrienteWhereInput {
  return {
    entidadId,
    ...(filters.temporadaId ? { temporadaId: filters.temporadaId } : {}),
    ...((filters.fechaDesde || filters.fechaHasta)
      ? {
          fecha: {
            ...(filters.fechaDesde ? { gte: new Date(filters.fechaDesde) } : {}),
            ...(filters.fechaHasta ? { lte: new Date(`${filters.fechaHasta}T23:59:59.999Z`) } : {}),
          },
        }
      : {}),
  }
}

export async function listMovimientos(entidadId: number, filters: CuentaCorrienteFilters) {
  const where = buildWhere(entidadId, filters)
  return prisma.movimientoCuentaCorriente.findMany({
    where,
    include: includeRefs,
    orderBy: { fecha: 'desc' },
  })
}

// R5b: saldo = Σ HABER − Σ DEBE (sobre TODOS los movimientos de la entidad, no solo los filtrados)
export async function calcularSaldo(entidadId: number): Promise<number> {
  const [haber, debe] = await Promise.all([
    prisma.movimientoCuentaCorriente.aggregate({
      where: { entidadId, naturaleza: 'HABER' },
      _sum: { monto: true },
    }),
    prisma.movimientoCuentaCorriente.aggregate({
      where: { entidadId, naturaleza: 'DEBE' },
      _sum: { monto: true },
    }),
  ])
  return Number(haber._sum.monto ?? 0) - Number(debe._sum.monto ?? 0)
}

export async function createMovimiento(entidadId: number, data: MovimientoCCCreateInput, usuarioId: string) {
  const { fecha, ...rest } = data
  return prisma.movimientoCuentaCorriente.create({
    data: { ...rest, entidadId, fecha: new Date(fecha), usuarioId },
    include: includeRefs,
  })
}

export async function getTipoCtaCteActivo(id: number) {
  return prisma.conceptoCtaCte.findFirst({ where: { id, eliminadoEn: null, bloqueado: false } })
}

// PROD-03: moneda y temporada deben existir, no estar eliminadas ni bloqueadas
export async function getMonedaActiva(id: number) {
  return prisma.moneda.findFirst({ where: { id, eliminadoEn: null, bloqueado: false } })
}

export async function getTemporadaActiva(id: number) {
  return prisma.temporada.findFirst({ where: { id, eliminadoEn: null, bloqueado: false } })
}
