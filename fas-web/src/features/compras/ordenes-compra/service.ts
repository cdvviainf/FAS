import { api } from '@/lib/api'
import type {
  OrdenCompraListResponse,
  OrdenCompraDetalle,
  OrdenCompraCreateInput,
  OrdenCompraUpdateInput,
  OrdenCompraLineaCreateInput,
  OrdenCompraLineaItem,
  EstadoOrdenCompra,
  NotaVentaDetalleDisponibilidad,
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

  async addLinea(id: number, data: OrdenCompraLineaCreateInput): Promise<{ data: OrdenCompraLineaItem }> {
    return api.post(`compras/ordenes-compra/${id}/lineas`, { json: data }).json()
  },

  async updateLinea(id: number, lineaId: number, data: OrdenCompraLineaCreateInput): Promise<{ data: OrdenCompraLineaItem }> {
    return api.patch(`compras/ordenes-compra/${id}/lineas/${lineaId}`, { json: data }).json()
  },

  async removeLinea(id: number, lineaId: number): Promise<void> {
    await api.delete(`compras/ordenes-compra/${id}/lineas/${lineaId}`)
  },

  async getDisponibilidadCierre(notaVentaId: number): Promise<{ data: NotaVentaDetalleDisponibilidad[] }> {
    return api.get(`compras/ordenes-compra/notas-venta/${notaVentaId}/disponibilidad`).json()
  },
}
