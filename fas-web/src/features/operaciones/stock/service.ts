import { api } from '@/lib/api'
import type { StockFiltros, StockResumenItem, StockDetalleItem } from './types'

function toSearchParams(filtros: StockFiltros): Record<string, string> {
  const sp: Record<string, string> = {}
  if (filtros.productorId) sp.productorId = String(filtros.productorId)
  if (filtros.especieId) sp.especieId = String(filtros.especieId)
  if (filtros.variedadId) sp.variedadId = String(filtros.variedadId)
  if (filtros.categoriaId) sp.categoriaId = String(filtros.categoriaId)
  if (filtros.calibreId) sp.calibreId = String(filtros.calibreId)
  if (filtros.origen) sp.origen = filtros.origen
  if (filtros.fechaDesde) sp.fechaDesde = filtros.fechaDesde
  if (filtros.fechaHasta) sp.fechaHasta = filtros.fechaHasta
  return sp
}

export const stockFrutaService = {
  async getResumen(filtros: StockFiltros): Promise<{ data: StockResumenItem[] }> {
    return api.get('operaciones/stock', { searchParams: toSearchParams(filtros) }).json()
  },
  async getDetalle(
    filtros: StockFiltros & { especieId: number; variedadId: number; categoriaId: number; calibreId: number },
  ): Promise<{ data: StockDetalleItem[] }> {
    return api.get('operaciones/stock/detalle', { searchParams: toSearchParams(filtros) }).json()
  },
}
