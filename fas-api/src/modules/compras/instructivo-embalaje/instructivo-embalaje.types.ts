export interface InstructivoEmbalajeDetalleInput {
  articuloId: number
  especieId: number
  variedadId: number
  categoriaId: number
  calibreMinId: number
  calibreMaxId: number
  tipoPalletId?: number | null
  cantidadPallets: number
  cajasPorPallet: number
  cajas: number
}

export interface InstructivoEmbalajeCreateInput {
  notaVentaId: number
  detalle: InstructivoEmbalajeDetalleInput[]
}
