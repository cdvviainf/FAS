export type { StockDetalleRow, MantenedorRef, OrigenStock, EstadoStock } from '@/features/reportes/stock-fruta/types'

export interface PalletUpdateInput {
  notaCalidadId?: number | null
  notaCondicionId?: number | null
  completo?: boolean
}
