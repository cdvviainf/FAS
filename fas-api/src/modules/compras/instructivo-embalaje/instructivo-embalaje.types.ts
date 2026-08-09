export interface InstructivoEmbalajeDetalleInput {
  articuloId: number
  especieId: number
  variedadId: number
  categoriaId: number
  calibreIds: number[]
  tipoPalletId?: number | null
  cantidadPallets: number
  cajasPorPallet: number
  cajas: number
}

export interface InstructivoEmbalajeCreateInput {
  notaVentaId: number
  detalle: InstructivoEmbalajeDetalleInput[]
}
