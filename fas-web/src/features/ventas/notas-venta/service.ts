import { api } from '@/lib/api'
import type {
  NotaVentaListResponse,
  NotaVentaDetalle,
  NotaVentaCreateInput,
  NotaVentaUpdateInput,
  NotaVentaDetalleCreateInput,
  NotaVentaDetalleItem,
} from './types'

export const notasVentaService = {
  async list(params: { page?: number; limit?: number; clienteId?: number } = {}): Promise<NotaVentaListResponse> {
    const sp: Record<string, string> = {}
    if (params.page) sp.page = String(params.page)
    if (params.limit) sp.limit = String(params.limit)
    if (params.clienteId) sp.clienteId = String(params.clienteId)
    return api.get('ventas/notas-venta', { searchParams: sp }).json()
  },

  async getById(id: number): Promise<{ data: NotaVentaDetalle }> {
    return api.get(`ventas/notas-venta/${id}`).json()
  },

  async create(data: NotaVentaCreateInput): Promise<{ data: NotaVentaDetalle }> {
    return api.post('ventas/notas-venta', { json: data }).json()
  },

  async update(id: number, data: NotaVentaUpdateInput): Promise<{ data: NotaVentaDetalle }> {
    return api.patch(`ventas/notas-venta/${id}`, { json: data }).json()
  },

  async remove(id: number): Promise<void> {
    await api.delete(`ventas/notas-venta/${id}`)
  },

  async addDetalle(id: number, data: NotaVentaDetalleCreateInput): Promise<{ data: NotaVentaDetalleItem }> {
    return api.post(`ventas/notas-venta/${id}/detalles`, { json: data }).json()
  },

  async updateDetalle(id: number, detalleId: number, data: NotaVentaDetalleCreateInput): Promise<{ data: NotaVentaDetalleItem }> {
    return api.patch(`ventas/notas-venta/${id}/detalles/${detalleId}`, { json: data }).json()
  },

  async removeDetalle(id: number, detalleId: number): Promise<void> {
    await api.delete(`ventas/notas-venta/${id}/detalles/${detalleId}`)
  },
}
