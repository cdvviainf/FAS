import { api } from '@/lib/api'
import type { NotaCalidad, NotaCalidadCreateInput, NotaCalidadUpdateInput } from './types'

export const notasCalidadService = {
  async list(): Promise<{ data: NotaCalidad[] }> {
    return api.get('config/notas-calidad').json()
  },
  async create(data: NotaCalidadCreateInput): Promise<{ data: NotaCalidad }> {
    return api.post('config/notas-calidad', { json: data }).json()
  },
  async update(id: number, data: NotaCalidadUpdateInput): Promise<{ data: NotaCalidad }> {
    return api.patch(`config/notas-calidad/${id}`, { json: data }).json()
  },
  async remove(id: number): Promise<void> {
    await api.delete(`config/notas-calidad/${id}`)
  },
}
