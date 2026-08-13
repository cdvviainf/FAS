import { api } from '@/lib/api'
import type {
  InstructivoEmbalajeListResponse,
  InstructivoEmbalajeDetalle,
  InstructivoEmbalajeCreateInput,
  InstructivoEmbalajeUpdateInput,
} from './types'

export const instructivoEmbalajeService = {
  async list(params: { page?: number; limit?: number; entidadProductorId?: number } = {}): Promise<InstructivoEmbalajeListResponse> {
    const sp: Record<string, string> = {}
    if (params.page) sp.page = String(params.page)
    if (params.limit) sp.limit = String(params.limit)
    if (params.entidadProductorId) sp.entidadProductorId = String(params.entidadProductorId)
    return api.get('compras/instructivos-embalaje', { searchParams: sp }).json()
  },

  async getById(id: number): Promise<{ data: InstructivoEmbalajeDetalle }> {
    return api.get(`compras/instructivos-embalaje/${id}`).json()
  },

  async create(data: InstructivoEmbalajeCreateInput): Promise<{ data: InstructivoEmbalajeDetalle }> {
    return api.post('compras/instructivos-embalaje', { json: data }).json()
  },

  async update(id: number, data: InstructivoEmbalajeUpdateInput): Promise<{ data: InstructivoEmbalajeDetalle }> {
    return api.patch(`compras/instructivos-embalaje/${id}`, { json: data }).json()
  },

  async remove(id: number): Promise<void> {
    await api.delete(`compras/instructivos-embalaje/${id}`)
  },
}
