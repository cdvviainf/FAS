import { api } from '@/lib/api'
import type {
  OrdenCompraMaterialListResponse,
  OrdenCompraMaterialDetalle,
  OrdenCompraMaterialCreateInput,
  OrdenCompraMaterialUpdateInput,
  OrdenCompraMaterialLineaInput,
  OrdenCompraMaterialLineaItem,
  EstadoOrdenCompraMaterial,
} from './types'

export const ordenesCompraMaterialService = {
  async list(params: { page?: number; limit?: number; entidadProveedorId?: number; estado?: EstadoOrdenCompraMaterial } = {}): Promise<OrdenCompraMaterialListResponse> {
    const sp: Record<string, string> = {}
    if (params.page) sp.page = String(params.page)
    if (params.limit) sp.limit = String(params.limit)
    if (params.entidadProveedorId) sp.entidadProveedorId = String(params.entidadProveedorId)
    if (params.estado) sp.estado = params.estado
    return api.get('materiales/ordenes-compra', { searchParams: sp }).json()
  },

  async getById(id: number): Promise<{ data: OrdenCompraMaterialDetalle }> {
    return api.get(`materiales/ordenes-compra/${id}`).json()
  },

  async create(data: OrdenCompraMaterialCreateInput): Promise<{ data: OrdenCompraMaterialDetalle }> {
    return api.post('materiales/ordenes-compra', { json: data }).json()
  },

  async update(id: number, data: OrdenCompraMaterialUpdateInput): Promise<{ data: OrdenCompraMaterialDetalle }> {
    return api.patch(`materiales/ordenes-compra/${id}`, { json: data }).json()
  },

  async emitir(id: number): Promise<{ data: OrdenCompraMaterialDetalle }> {
    return api.post(`materiales/ordenes-compra/${id}/emitir`).json()
  },

  async remove(id: number): Promise<void> {
    await api.delete(`materiales/ordenes-compra/${id}`)
  },

  async addLinea(id: number, data: OrdenCompraMaterialLineaInput): Promise<{ data: OrdenCompraMaterialLineaItem }> {
    return api.post(`materiales/ordenes-compra/${id}/lineas`, { json: data }).json()
  },

  async updateLinea(id: number, lineaId: number, data: OrdenCompraMaterialLineaInput): Promise<{ data: OrdenCompraMaterialLineaItem }> {
    return api.patch(`materiales/ordenes-compra/${id}/lineas/${lineaId}`, { json: data }).json()
  },

  async removeLinea(id: number, lineaId: number): Promise<void> {
    await api.delete(`materiales/ordenes-compra/${id}/lineas/${lineaId}`)
  },
}
