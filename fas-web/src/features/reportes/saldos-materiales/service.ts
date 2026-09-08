import { api } from '@/lib/api'
import type { SaldoMaterialRow } from './types'

export const saldosMaterialesService = {
  // Sin query params: trae todo, el filtrado (Bodega/Tipo) es client-side
  // por facetas, igual que stock-fruta (los volúmenes de Materiales no
  // justifican paginación server-side todavía).
  async list(): Promise<{ data: SaldoMaterialRow[] }> {
    return api.get('materiales/saldos').json()
  },
}
