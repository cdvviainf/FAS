import { api } from '@/lib/api'
import type { Predio, PredioCreateInput, PredioUpdateInput } from './types'

export const prediosService = {
  async list(entidadId: number): Promise<{ data: Predio[] }> {
    return api.get(`productores/${entidadId}/predios`).json()
  },
  async create(entidadId: number, data: PredioCreateInput): Promise<{ data: Predio }> {
    return api.post(`productores/${entidadId}/predios`, { json: data }).json()
  },
  async update(entidadId: number, predioId: number, data: PredioUpdateInput): Promise<{ data: Predio }> {
    return api.patch(`productores/${entidadId}/predios/${predioId}`, { json: data }).json()
  },
  async remove(entidadId: number, predioId: number): Promise<void> {
    await api.delete(`productores/${entidadId}/predios/${predioId}`)
  },
}
