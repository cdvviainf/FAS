import { api } from '@/lib/api'
import type { StockDetalleRow } from './types'

export const stockFrutaService = {
  async list(): Promise<{ data: StockDetalleRow[] }> {
    return api.get('operaciones/stock').json()
  },
}
