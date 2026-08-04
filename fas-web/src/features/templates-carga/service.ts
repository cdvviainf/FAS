import { api } from '@/lib/api'
import type { TemplateCarga, TemplateCargaCreateInput, TemplateCargaUpdateInput, TipoTemplateCarga } from './types'

export const templatesCargaService = {
  async list(params: { q?: string; tipo?: TipoTemplateCarga } = {}): Promise<{ data: TemplateCarga[] }> {
    const searchParams: Record<string, string> = {}
    if (params.q) searchParams.q = params.q
    if (params.tipo) searchParams.tipo = params.tipo
    return api.get('config/templates-carga', { searchParams }).json()
  },
  async getById(id: number): Promise<{ data: TemplateCarga }> {
    return api.get(`config/templates-carga/${id}`).json()
  },
  async create(data: TemplateCargaCreateInput): Promise<{ data: TemplateCarga }> {
    return api.post('config/templates-carga', { json: data }).json()
  },
  async update(id: number, data: TemplateCargaUpdateInput): Promise<{ data: TemplateCarga }> {
    return api.patch(`config/templates-carga/${id}`, { json: data }).json()
  },
  async remove(id: number): Promise<void> {
    await api.delete(`config/templates-carga/${id}`)
  },
}
