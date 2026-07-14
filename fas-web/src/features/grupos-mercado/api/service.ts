import { api } from '@/lib/api'
import type { GrupoMercadoFilters, GrupoMercadoMutationPayload, GrupoMercado, GruposMercadoResponse } from './types'

export async function getGruposMercado(filters: GrupoMercadoFilters = {}): Promise<GruposMercadoResponse> {
  const params: Record<string, string> = {}
  if (filters.q) params.q = filters.q
  if (filters.page) params.page = String(filters.page)
  if (filters.limit) params.limit = String(filters.limit)

  const response = await api.get('config/grupos-mercado', { searchParams: params }).json<{
    data: GrupoMercado[]
    meta: { total: number; page: number; limit: number; totalPages: number }
  }>()

  return {
    grupos: response.data,
    total: response.meta.total
  }
}

export async function createGrupoMercado(data: GrupoMercadoMutationPayload): Promise<GrupoMercado> {
  return api.post('config/grupos-mercado', { json: data }).json()
}

export async function updateGrupoMercado(id: number, data: GrupoMercadoMutationPayload): Promise<GrupoMercado> {
  return api.patch(`config/grupos-mercado/${id}`, { json: data }).json()
}

export async function deleteGrupoMercado(id: number): Promise<void> {
  await api.delete(`config/grupos-mercado/${id}`)
}
