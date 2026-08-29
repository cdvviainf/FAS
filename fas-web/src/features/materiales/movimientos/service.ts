import { api } from '@/lib/api'
import type {
  Movimiento,
  MovimientoCreateInput,
  MovimientoUpdateInput,
  MovimientoDetalleInput,
  MovimientoDetalleItem,
  MovimientoListResponse,
  MovimientoListFilters,
} from './types'

export const movimientosService = {
  async list(filters: MovimientoListFilters = {}): Promise<MovimientoListResponse> {
    const sp: Record<string, string> = {}
    if (filters.tipoMovimientoId) sp.tipoMovimientoId = String(filters.tipoMovimientoId)
    if (filters.estado) sp.estado = filters.estado
    if (filters.fechaDesde) sp.fechaDesde = filters.fechaDesde
    if (filters.fechaHasta) sp.fechaHasta = filters.fechaHasta
    if (filters.bodegaId) sp.bodegaId = String(filters.bodegaId)
    if (filters.page) sp.page = String(filters.page)
    if (filters.limit) sp.limit = String(filters.limit)
    return api.get('materiales/movimientos', { searchParams: sp }).json()
  },
  async getById(id: number): Promise<{ data: Movimiento }> {
    return api.get(`materiales/movimientos/${id}`).json()
  },
  async create(data: MovimientoCreateInput): Promise<{ data: Movimiento }> {
    return api.post('materiales/movimientos', { json: data }).json()
  },
  async update(id: number, data: MovimientoUpdateInput): Promise<{ data: Movimiento }> {
    return api.patch(`materiales/movimientos/${id}`, { json: data }).json()
  },
  async remove(id: number): Promise<void> {
    await api.delete(`materiales/movimientos/${id}`)
  },
  async addLinea(id: number, data: MovimientoDetalleInput): Promise<{ data: MovimientoDetalleItem }> {
    return api.post(`materiales/movimientos/${id}/detalle`, { json: data }).json()
  },
  async updateLinea(id: number, detalleId: number, data: MovimientoDetalleInput): Promise<{ data: MovimientoDetalleItem }> {
    return api.patch(`materiales/movimientos/${id}/detalle/${detalleId}`, { json: data }).json()
  },
  async removeLinea(id: number, detalleId: number): Promise<void> {
    await api.delete(`materiales/movimientos/${id}/detalle/${detalleId}`)
  },
  async confirmar(id: number): Promise<{ data: Movimiento }> {
    return api.post(`materiales/movimientos/${id}/confirmar`).json()
  },
}
