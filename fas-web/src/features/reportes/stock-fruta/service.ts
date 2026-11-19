import { api } from '@/lib/api'
import type { StockDetalleRow, Lote, LoteEditarInput, PredioCsg } from './types'

export const stockFrutaService = {
  async list(temporadaId?: number): Promise<{ data: StockDetalleRow[] }> {
    return api.get('operaciones/stock', { searchParams: temporadaId ? { temporadaId: String(temporadaId) } : {} }).json()
  },

  // Edición de Stock (2026-09-28, OPER_STOCK_EDICION).
  async obtenerLote(palletId: number): Promise<{ data: Lote }> {
    return api.get(`operaciones/stock/pallets/${palletId}/lote`).json()
  },
  async editarLote(palletId: number, data: LoteEditarInput): Promise<{ data: Lote }> {
    return api.patch(`operaciones/stock/pallets/${palletId}/lote`, { json: data }).json()
  },
  // CSG (predios) del productor para la edición del lote (2026-11-19).
  async prediosDeProductor(productorId: number): Promise<{ data: PredioCsg[] }> {
    return api.get(`operaciones/stock/productores/${productorId}/predios`).json()
  },
  // Eliminar pallet (soft delete, 2026-10-12) — solo stock libre.
  async eliminarPallet(palletId: number): Promise<void> {
    await api.delete(`operaciones/stock/pallets/${palletId}`)
  },
}
