import { api } from '@/lib/api'
import type { InformeCC, MovimientoCCCreateInput } from './types'

export const cuentaCorrienteService = {
  async getInforme(entidadId: number, filters: { fechaDesde?: string; fechaHasta?: string; temporadaId?: number } = {}): Promise<{ data: InformeCC }> {
    const sp: Record<string, string> = {}
    if (filters.fechaDesde) sp.fechaDesde = filters.fechaDesde
    if (filters.fechaHasta) sp.fechaHasta = filters.fechaHasta
    if (filters.temporadaId) sp.temporadaId = String(filters.temporadaId)
    return api.get(`productores/${entidadId}/cuenta-corriente`, { searchParams: sp }).json()
  },
  async imputar(entidadId: number, data: MovimientoCCCreateInput) {
    return api.post(`productores/${entidadId}/cuenta-corriente`, { json: data }).json()
  },
}
