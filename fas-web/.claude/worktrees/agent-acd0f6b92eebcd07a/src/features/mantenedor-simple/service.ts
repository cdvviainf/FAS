import { api } from '@/lib/api'
import type {
  MantenedorSimple,
  MantenedorSimpleListResponse,
  MantenedorSimpleFilters,
  MantenedorSimpleCreateInput
} from './types'

export function createMantenedorService(recurso: string) {
  return {
    async list(filters: MantenedorSimpleFilters = {}): Promise<MantenedorSimpleListResponse> {
      const params: Record<string, string> = {}
      if (filters.q) params.q = filters.q
      if (filters.page) params.page = String(filters.page)
      if (filters.limit) params.limit = String(filters.limit)
      return api.get(`config/${recurso}`, { searchParams: params }).json()
    },
    async getById(id: number): Promise<MantenedorSimple> {
      return api.get(`config/${recurso}/${id}`).json()
    },
    async create(data: MantenedorSimpleCreateInput): Promise<MantenedorSimple> {
      return api.post(`config/${recurso}`, { json: data }).json()
    },
    async update(id: number, data: Partial<MantenedorSimpleCreateInput>): Promise<MantenedorSimple> {
      return api.patch(`config/${recurso}/${id}`, { json: data }).json()
    },
    async remove(id: number): Promise<void> {
      await api.delete(`config/${recurso}/${id}`)
    }
  }
}
