import { api } from '@/lib/api'
import type {
  OrdenCompraListResponse,
  OrdenCompraDetalle,
  OrdenCompraCreateInput,
  OrdenCompraUpdateInput,
  EstadoOrdenCompra,
} from './types'

export const ordenesCompraService = {
  async list(params: { page?: number; limit?: number; entidadProductorId?: number; estado?: EstadoOrdenCompra } = {}): Promise<OrdenCompraListResponse> {
    const sp: Record<string, string> = {}
    if (params.page) sp.page = String(params.page)
    if (params.limit) sp.limit = String(params.limit)
    if (params.entidadProductorId) sp.entidadProductorId = String(params.entidadProductorId)
    if (params.estado) sp.estado = params.estado
    return api.get('compras/ordenes-compra', { searchParams: sp }).json()
  },

  async getById(id: number): Promise<{ data: OrdenCompraDetalle }> {
    return api.get(`compras/ordenes-compra/${id}`).json()
  },

  async create(data: OrdenCompraCreateInput): Promise<{ data: OrdenCompraDetalle }> {
    return api.post('compras/ordenes-compra', { json: data }).json()
  },

  async update(id: number, data: OrdenCompraUpdateInput): Promise<{ data: OrdenCompraDetalle }> {
    return api.patch(`compras/ordenes-compra/${id}`, { json: data }).json()
  },

  async remove(id: number): Promise<void> {
    await api.delete(`compras/ordenes-compra/${id}`)
  },
}
