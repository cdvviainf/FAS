import { api } from '@/lib/api'
import type { Receta, RecetaCreateInput, RecetaUpdateInput } from './types'

export const recetasService = {
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
