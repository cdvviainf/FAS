export interface StockPorBodega {
  bodegaId: number
  bodega: { id: number; codigo: string; descripcion: string }
  cantidad: number
}

export type EstadoStockReceta = 'NA' | 'OK' | 'WARNING' | 'DANGER'

export interface ResultadoConsultaStock {
  articuloId: number
  codigo: string
  descripcion: string
  demanda: number
  stockTotal: number
  stockPorBodega: StockPorBodega[]
  estado: EstadoStockReceta
  motivos: string[]
}

export interface EmbalajeCantidad {
  articuloId: number
  cantidad: number
}
