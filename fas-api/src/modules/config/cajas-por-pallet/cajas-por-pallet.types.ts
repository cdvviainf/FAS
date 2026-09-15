export interface CajasPorPalletCreateInput {
  articuloId: number
  tipoPalletId: number
  cajasPorPallet: number
}

export type CajasPorPalletUpdateInput = Partial<CajasPorPalletCreateInput>

export interface CajasPorPalletListFilters {
  page?: number
  limit?: number
  articuloId?: number
  tipoPalletId?: number
}
