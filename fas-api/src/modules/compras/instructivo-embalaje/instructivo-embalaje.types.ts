export interface InstructivoEmbalajeDetalleInput {
  articuloId: number
  especieId: number
  variedadId: number
  categoriaId: number
  calibreMinId: number
  calibreMaxId: number
  cantidadPallets: number
  cajasPorPallet: number
}

export interface InstructivoEmbalajeCreateInput {
  notaVentaId: number
  detalle: InstructivoEmbalajeDetalleInput[]
}
