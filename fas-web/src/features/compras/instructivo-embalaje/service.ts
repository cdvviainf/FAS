import { api } from '@/lib/api'
import type {
  InstructivoEmbalajeListResponse,
  InstructivoEmbalajeDetalle,
  InstructivoEmbalajeCreateInput,
} from './types'

export const instructivoEmbalajeService = {
  async list(params: { page?: number; limit?: number; notaVentaId?: number } = {}): Promise<InstructivoEmbalajeListResponse> {
    const sp: Record<string, string> = {}
    if (params.page) sp.page = String(params.page)
    if (params.limit) sp.limit = String(params.limit)
    if (params.notaVentaId) sp.notaVentaId = String(params.notaVentaId)
    return api.get('compras/instructivos-embalaje', { searchParams: sp }).json()
  },

  async getById(id: number): Promise<{ data: InstructivoEmbalajeDetalle }> {
    return api.get(`compras/instructivos-embalaje/${id}`).json()
  },

  async create(data: InstructivoEmbalajeCreateInput): Promise<{ data: InstructivoEmbalajeDetalle }> {
    return api.post('compras/instructivos-embalaje', { json: data }).json()
  },
}
