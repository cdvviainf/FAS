import { api } from '@/lib/api'
import type { ProductorListResponse, ProductorFicha } from './types'

export const productoresService = {
  async list(params: { q?: string; page?: number; limit?: number } = {}): Promise<ProductorListResponse> {
    const sp: Record<string, string> = {}
    if (params.q) sp.q = params.q
    if (params.page) sp.page = String(params.page)
    if (params.limit) sp.limit = String(params.limit)
    return api.get('productores', { searchParams: sp }).json()
  },

  async getFicha(entidadId: number): Promise<{ data: ProductorFicha }> {
    return api.get(`productores/${entidadId}`).json()
  },
}
