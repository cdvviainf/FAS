import { api } from '@/lib/api'
import type { ConceptoLiquidacion, ConceptoLiquidacionCreateInput, ConceptoLiquidacionUpdateInput } from './types'

export const conceptosLiquidacionService = {
  async list(): Promise<{ data: ConceptoLiquidacion[] }> {
    return api.get('config/conceptos-liquidacion').json()
  },
  async getById(id: number): Promise<{ data: ConceptoLiquidacion }> {
    return api.get(`config/conceptos-liquidacion/${id}`).json()
  },
  async create(data: ConceptoLiquidacionCreateInput): Promise<{ data: ConceptoLiquidacion }> {
    return api.post('config/conceptos-liquidacion', { json: data }).json()
  },
  async update(id: number, data: ConceptoLiquidacionUpdateInput): Promise<{ data: ConceptoLiquidacion }> {
    return api.patch(`config/conceptos-liquidacion/${id}`, { json: data }).json()
  },
  async remove(id: number): Promise<void> {
    await api.delete(`config/conceptos-liquidacion/${id}`)
  },
}
