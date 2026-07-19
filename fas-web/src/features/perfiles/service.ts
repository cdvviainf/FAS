import { api } from '@/lib/api'
import type { Perfil, PerfilDetalle, PerfilListResponse, PerfilCreateInput, PerfilUpdateInput, ItemMenu } from './types'

export const perfilesService = {
  async list(params: { page?: number; limit?: number; q?: string } = {}): Promise<PerfilListResponse> {
    const searchParams: Record<string, string> = {}
    if (params.page) searchParams.page = String(params.page)
    if (params.limit) searchParams.limit = String(params.limit)
    if (params.q) searchParams.q = params.q
    return api.get('config/perfiles', { searchParams }).json()
  },

  async getById(id: number): Promise<PerfilDetalle> {
    return api.get(`config/perfiles/${id}`).json()
  },

  async create(data: PerfilCreateInput): Promise<PerfilDetalle> {
    return api.post('config/perfiles', { json: data }).json()
  },

  async update(id: number, data: PerfilUpdateInput): Promise<PerfilDetalle> {
    return api.patch(`config/perfiles/${id}`, { json: data }).json()
  },

  async remove(id: number): Promise<void> {
    await api.delete(`config/perfiles/${id}`)
  },

  async listItemsMenu(): Promise<ItemMenu[]> {
    return api.get('config/items-menu').json()
  },
}

export type { Perfil, PerfilDetalle, PerfilListResponse, PerfilCreateInput, PerfilUpdateInput, ItemMenu }
