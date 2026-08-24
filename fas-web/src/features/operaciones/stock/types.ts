export interface MantenedorRef {
  id: number
  codigo: string
  descripcion: string
}

export type OrigenStock = 'COMPRA' | 'CONSIGNACION' | 'PROCESO'

export const ORIGEN_STOCK_LABELS: Record<OrigenStock, string> = {
  COMPRA: 'Compra',
  CONSIGNACION: 'Consignación',
  PROCESO: 'Proceso',
}

export interface StockFiltros {
  productorId?: number
  especieId?: number
  variedadId?: number
  categoriaId?: number
  calibreId?: number
  origen?: OrigenStock
  fechaDesde?: string
  fechaHasta?: string
}

export interface StockResumenItem {
  especieId: number
  especie: MantenedorRef
  variedadId: number
  variedad: MantenedorRef
  categoriaId: number
  categoria: MantenedorRef
  calibreId: number
  calibre: MantenedorRef
  cajas: number
  pallets: number
}

export interface StockDetalleItem {
  palletLineaId: number
  palletId: number
  numeroPallet: string
  origen: OrigenStock
  creadoEn: string
  productor: { id: number; codigo: string; descripcion: string; razonSocial: string }
  cajas: number
}
