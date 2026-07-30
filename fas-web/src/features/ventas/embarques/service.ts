import { api } from '@/lib/api'
import type { Embarque, EmbarqueCreateInput, EmbarqueListResponse } from './types'

export const embarquesService = {
  async list(params: { notaVentaId?: number; page?: number; limit?: number } = {}): Promise<EmbarqueListResponse> {
    const sp: Record<string, string> = {}
    if (params.notaVentaId) sp.notaVentaId = String(params.notaVentaId)
    if (params.page) sp.page = String(params.page)
    if (params.limit) sp.limit = String(params.limit)
    return api.get('ventas/embarques', { searchParams: sp }).json()
  },

  async getById(id: number): Promise<{ data: Embarque }> {
    return api.get(`ventas/embarques/${id}`).json()
  },

  async create(data: EmbarqueCreateInput): Promise<{ data: Embarque }> {
    return api.post('ventas/embarques', { json: data }).json()
  },
}
