import { api } from '@/lib/api'
import type { Receta, RecetaCreateInput, RecetaUpdateInput, RecetaListFilters, RecetaListResponse } from './types'

export const recetasService = {
  async list(filters: RecetaListFilters = {}): Promise<RecetaListResponse> {
    const sp: Record<string, string> = {}
    if (filters.q) sp.q = filters.q
    if (filters.page) sp.page = String(filters.page)
    if (filters.limit) sp.limit = String(filters.limit)
    return api.get('materiales/recetas', { searchParams: sp }).json()
  },

  async listPorEmbalaje(embalajeId: number): Promise<{ data: Receta[] }> {
    return api.get(`materiales/articulos/${embalajeId}/recetas`).json()
  },

  async getById(id: number): Promise<{ data: Receta }> {
    return api.get(`materiales/recetas/${id}`).json()
  },

  async create(data: RecetaCreateInput): Promise<{ data: Receta }> {
    return api.post('materiales/recetas', { json: data }).json()
  },

  async update(id: number, data: RecetaUpdateInput): Promise<{ data: Receta }> {
    return api.patch(`materiales/recetas/${id}`, { json: data }).json()
  },
}
