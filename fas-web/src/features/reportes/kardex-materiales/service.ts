import { api } from '@/lib/api'
import type { KardexFilters, KardexResult } from './types'

export const kardexMaterialesService = {
  async obtener(filters: KardexFilters): Promise<{ data: KardexResult }> {
    const sp: Record<string, string> = { articuloId: String(filters.articuloId) }
    if (filters.bodegaId) sp.bodegaId = String(filters.bodegaId)
    if (filters.fechaDesde) sp.fechaDesde = filters.fechaDesde
    if (filters.fechaHasta) sp.fechaHasta = filters.fechaHasta
    return api.get('materiales/kardex', { searchParams: sp }).json()
  },
}
