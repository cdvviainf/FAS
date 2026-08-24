export type OrigenStock = 'COMPRA' | 'CONSIGNACION' | 'PROCESO'

export interface StockFiltros {
  productorId?: number
  especieId?: number
  variedadId?: number
  categoriaId?: number
  calibreId?: number
  origen?: OrigenStock
  fechaDesde?: Date
  fechaHasta?: Date
}
