import { api } from '@/lib/api'
import type { PaisFilters, PaisMutationPayload, Pais, PaisesResponse } from './types'

export async function getPaises(filters: PaisFilters = {}): Promise<PaisesResponse> {
  const params: Record<string, string> = {}
  if (filters.q) params.q = filters.q
  if (filters.page) params.page = String(filters.page)
  if (filters.limit) params.limit = String(filters.limit)

  const response = await api.get('config/paises', { searchParams: params }).json<{
    data: Pais[]
    meta: { total: number; page: number; limit: number; totalPages: number }
  }>()

  return {
    paises: response.data,
    total: response.meta.total
  }
}

export async function createPais(data: PaisMutationPayload): Promise<Pais> {
  return api.post('config/paises', { json: data }).json()
}

export async function updatePais(id: number, data: PaisMutationPayload): Promise<Pais> {
  return api.patch(`config/paises/${id}`, { json: data }).json()
}

export async function deletePais(id: number): Promise<void> {
  await api.delete(`config/paises/${id}`)
}
