import { api } from '@/lib/api'
import type { CondicionPago, CondicionPagoCreateInput, CondicionPagoUpdateInput, TipoCondicionPago } from './types'

export const condicionesPagoService = {
  async list(params?: { q?: string; tipo?: TipoCondicionPago }): Promise<{ data: CondicionPago[] }> {
    const searchParams: Record<string, string> = {}
    if (params?.q) searchParams.q = params.q
    if (params?.tipo) searchParams.tipo = params.tipo
    return api.get('config/condiciones-pago', { searchParams: Object.keys(searchParams).length ? searchParams : undefined }).json()
  },
  async getById(id: number): Promise<{ data: CondicionPago }> {
    return api.get(`config/condiciones-pago/${id}`).json()
  },
  async create(data: CondicionPagoCreateInput): Promise<{ data: CondicionPago }> {
    return api.post('config/condiciones-pago', { json: data }).json()
  },
  async update(id: number, data: CondicionPagoUpdateInput): Promise<{ data: CondicionPago }> {
    return api.patch(`config/condiciones-pago/${id}`, { json: data }).json()
  },
  async remove(id: number): Promise<void> {
    await api.delete(`config/condiciones-pago/${id}`)
  },
}
