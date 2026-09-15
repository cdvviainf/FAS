export interface CajasPorPallet {
  id: number
  articuloId: number
  tipoPalletId: number
  cajasPorPallet: number
  articulo?: { id: number; codigo: string; descripcion: string }
  tipoPallet?: { id: number; codigo: string; descripcion: string }
}

export interface CajasPorPalletCreateInput {
  articuloId: number
  tipoPalletId: number
  cajasPorPallet: number
}

export type CajasPorPalletUpdateInput = Partial<CajasPorPalletCreateInput>

export interface MatrizEmbalajeRow {
  articuloId: number
  codigo: string
  descripcion: string
  cajasPorPallet: number | null
}
