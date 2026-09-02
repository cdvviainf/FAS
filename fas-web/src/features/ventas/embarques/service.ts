import { api } from '@/lib/api'
import type { Embarque, EmbarqueCreateInput, EmbarqueDetalle, EmbarqueListResponse, PalletResumen } from './types'

export const embarquesService = {
  async list(params: { notaVentaId?: number; page?: number; limit?: number } = {}): Promise<EmbarqueListResponse> {
    const sp: Record<string, string> = {}
    if (params.notaVentaId) sp.notaVentaId = String(params.notaVentaId)
    if (params.page) sp.page = String(params.page)
    if (params.limit) sp.limit = String(params.limit)
    return api.get('ventas/embarques', { searchParams: sp }).json()
  },

  async getById(id: number): Promise<{ data: EmbarqueDetalle }> {
    return api.get(`ventas/embarques/${id}`).json()
  },

  async create(data: EmbarqueCreateInput): Promise<{ data: Embarque }> {
    return api.post('ventas/embarques', { json: data }).json()
  },

  // ─── Seleccionar Pallets ──────────────────────────────────────────────────

  async listarPalletsDisponibles(id: number): Promise<{ data: PalletResumen[] }> {
    return api.get(`ventas/embarques/${id}/pallets-disponibles`).json()
  },

  async agregarPallets(id: number, palletIds: number[]): Promise<{ data: EmbarqueDetalle }> {
    return api.post(`ventas/embarques/${id}/pallets`, { json: { palletIds } }).json()
  },

  async quitarPallet(id: number, palletId: number): Promise<{ data: EmbarqueDetalle }> {
    return api.delete(`ventas/embarques/${id}/pallets/${palletId}`).json()
  },

  // ─── Despachar ────────────────────────────────────────────────────────────

  async despachar(id: number): Promise<{ data: EmbarqueDetalle }> {
    return api.patch(`ventas/embarques/${id}/despachar`).json()
  },
}
