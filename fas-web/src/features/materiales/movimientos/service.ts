import { api } from '@/lib/api'
import type {
  Movimiento,
  MovimientoCreateInput,
  MovimientoListResponse,
  MovimientoListFilters,
} from './types'

export const movimientosService = {
  async list(filters: MovimientoListFilters = {}): Promise<MovimientoListResponse> {
    const sp: Record<string, string> = {}
    if (filters.tipoMovimientoId) sp.tipoMovimientoId = String(filters.tipoMovimientoId)
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
}
