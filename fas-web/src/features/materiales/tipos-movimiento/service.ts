import { api } from '@/lib/api'
import type {
  TipoMovimiento,
  TipoMovimientoCreateInput,
  TipoMovimientoUpdateInput,
  TipoMovimientoListResponse,
  TipoMovimientoListFilters,
} from './types'

export const tiposMovimientoService = {
  async list(filters: TipoMovimientoListFilters = {}): Promise<TipoMovimientoListResponse> {
    const sp: Record<string, string> = {}
    if (filters.modulo) sp.modulo = filters.modulo
    if (filters.clase) sp.clase = filters.clase
    if (filters.activo !== undefined) sp.activo = String(filters.activo)
    if (filters.page) sp.page = String(filters.page)
    if (filters.limit) sp.limit = String(filters.limit)
    return api.get('materiales/tipos-movimiento', { searchParams: sp }).json()
  },
  async getById(id: number): Promise<{ data: TipoMovimiento }> {
    return api.get(`materiales/tipos-movimiento/${id}`).json()
  },
  async create(data: TipoMovimientoCreateInput): Promise<{ data: TipoMovimiento }> {
    return api.post('materiales/tipos-movimiento', { json: data }).json()
  },
  async update(id: number, data: TipoMovimientoUpdateInput): Promise<{ data: TipoMovimiento }> {
    return api.patch(`materiales/tipos-movimiento/${id}`, { json: data }).json()
  },
}
