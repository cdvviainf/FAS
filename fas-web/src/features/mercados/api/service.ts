import { api } from '@/lib/api'
import type { MercadoFilters, MercadoMutationPayload, Mercado, MercadosResponse } from './types'

export async function getMercados(filters: MercadoFilters): Promise<MercadosResponse> {
  const params: Record<string, string> = {}
  if (filters.q) params.q = filters.q
  if (filters.page) params.page = String(filters.page)
  if (filters.limit) params.limit = String(filters.limit)

  const response = await api.get('config/mercados', { searchParams: params }).json<{
    data: Mercado[]
    meta: { total: number; page: number; limit: number; totalPages: number }
  }>()

  return {
    mercados: response.data,
    total: response.meta.total
  }
}

export async function createMercado(data: MercadoMutationPayload): Promise<Mercado> {
  return api.post('config/mercados', { json: data }).json()
}

export async function updateMercado(id: number, data: MercadoMutationPayload): Promise<Mercado> {
  return api.patch(`config/mercados/${id}`, { json: data }).json()
}

export async function deleteMercado(id: number): Promise<void> {
  await api.delete(`config/mercados/${id}`)
}
