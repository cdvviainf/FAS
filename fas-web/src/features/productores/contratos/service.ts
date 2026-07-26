import { api } from '@/lib/api'
import type { Contrato, ContratoAdjunto, ContratoCreateInput, ContratoUpdateInput } from './types'

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
  async agregarAdjunto(entidadId: number, contratoId: number, archivo: File): Promise<{ data: ContratoAdjunto }> {
    const formData = new FormData()
    formData.append('file', archivo)
    return api.post(`productores/${entidadId}/contratos/${contratoId}/adjuntos`, { body: formData }).json()
  },
  async eliminarAdjunto(entidadId: number, contratoId: number, adjuntoId: number): Promise<void> {
    await api.delete(`productores/${entidadId}/contratos/${contratoId}/adjuntos/${adjuntoId}`)
  },
  urlDescargaAdjunto(entidadId: number, contratoId: number, adjuntoId: number): string {
    // Ruta relativa (mismo origen) para que el navegador envíe la cookie de
    // sesión — ver comentario en src/lib/api.ts.
    return `/api/productores/${entidadId}/contratos/${contratoId}/adjuntos/${adjuntoId}`
  },
}
