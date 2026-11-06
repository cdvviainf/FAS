import { api } from '@/lib/api'
import type { StockDetalleRow, PalletUpdateInput } from './types'

export const gestionPalletsService = {
  async list(temporadaId?: number): Promise<{ data: StockDetalleRow[] }> {
    return api.get('operaciones/stock/pallets', { searchParams: temporadaId ? { temporadaId: String(temporadaId) } : {} }).json()
  },
  async update(palletId: number, data: PalletUpdateInput): Promise<{ data: unknown }> {
    return api.patch(`operaciones/stock/pallets/${palletId}`, { json: data }).json()
  },
}
