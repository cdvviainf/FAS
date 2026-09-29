import { api } from '@/lib/api'
import type { StockDetalleRow, Lote, LoteEditarInput } from './types'

export const stockFrutaService = {
  async list(): Promise<{ data: StockDetalleRow[] }> {
    return api.get('operaciones/stock').json()
  },

  // Edición de Stock (2026-09-28, OPER_STOCK_EDICION).
  async obtenerLote(palletId: number): Promise<{ data: Lote }> {
    return api.get(`operaciones/stock/pallets/${palletId}/lote`).json()
  },
  async editarLote(palletId: number, data: LoteEditarInput): Promise<{ data: Lote }> {
    return api.patch(`operaciones/stock/pallets/${palletId}/lote`, { json: data }).json()
  },
}
