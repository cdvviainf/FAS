import { api } from '@/lib/api'
import type { NotaCondicion, NotaCondicionCreateInput, NotaCondicionUpdateInput } from './types'

export const notasCondicionService = {
  async list(): Promise<{ data: NotaCondicion[] }> {
    return api.get('config/notas-condicion').json()
  },
  async create(data: NotaCondicionCreateInput): Promise<{ data: NotaCondicion }> {
    return api.post('config/notas-condicion', { json: data }).json()
  },
  async update(id: number, data: NotaCondicionUpdateInput): Promise<{ data: NotaCondicion }> {
    return api.patch(`config/notas-condicion/${id}`, { json: data }).json()
  },
  async remove(id: number): Promise<void> {
    await api.delete(`config/notas-condicion/${id}`)
  },
}
