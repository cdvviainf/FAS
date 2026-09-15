import { api } from '@/lib/api'
import type { TemplateCarga, TemplateCargaCreateInput, TemplateCargaUpdateInput, TipoTemplateCarga } from './types'

export const templatesCargaService = {
  async list(params: { q?: string; tipo?: TipoTemplateCarga } = {}): Promise<{ data: TemplateCarga[] }> {
    const searchParams: Record<string, string> = {}
    if (params.q) searchParams.q = params.q
    if (params.tipo) searchParams.tipo = params.tipo
    return api.get('config/templates-carga', { searchParams }).json()
  },
  async getById(id: number): Promise<{ data: TemplateCarga }> {
    return api.get(`config/templates-carga/${id}`).json()
  },
  async create(data: TemplateCargaCreateInput): Promise<{ data: TemplateCarga }> {
    return api.post('config/templates-carga', { json: data }).json()
  },
  async update(id: number, data: TemplateCargaUpdateInput): Promise<{ data: TemplateCarga }> {
    return api.patch(`config/templates-carga/${id}`, { json: data }).json()
  },
  async remove(id: number): Promise<void> {
    await api.delete(`config/templates-carga/${id}`)
  },
  // Descarga el Excel en blanco (formato base) con las columnas del template,
  // listo para llenar y subir.
  async descargarFormatoBase(id: number, nombreArchivo: string): Promise<void> {
    const blob = await api.get(`config/templates-carga/${id}/formato-base`).blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = nombreArchivo
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  },
}
