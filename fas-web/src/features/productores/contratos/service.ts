import { api } from '@/lib/api'
import type { Contrato, ContratoCreateInput, ContratoUpdateInput } from './types'

export const contratosService = {
  async list(entidadId: number): Promise<{ data: Contrato[] }> {
    return api.get(`productores/${entidadId}/contratos`).json()
  },
  async create(entidadId: number, data: ContratoCreateInput): Promise<{ data: Contrato }> {
    return api.post(`productores/${entidadId}/contratos`, { json: data }).json()
  },
  async update(entidadId: number, contratoId: number, data: ContratoUpdateInput): Promise<{ data: Contrato }> {
    return api.patch(`productores/${entidadId}/contratos/${contratoId}`, { json: data }).json()
  },
  async remove(entidadId: number, contratoId: number): Promise<void> {
    await api.delete(`productores/${entidadId}/contratos/${contratoId}`)
  },
  async subirPdf(entidadId: number, contratoId: number, archivo: File): Promise<{ data: Contrato }> {
    const formData = new FormData()
    formData.append('file', archivo)
    return api.post(`productores/${entidadId}/contratos/${contratoId}/pdf`, { body: formData }).json()
  },
  urlDescargaPdf(entidadId: number, contratoId: number): string {
    const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api'
    return `${base}/productores/${entidadId}/contratos/${contratoId}/pdf`
  },
}
