export interface InstructivoEmbalajeDetalleInput {
  articuloId: number
  especieId: number
  variedadId: number
  // Segunda variedad opcional, de la misma especie (2026-08-12).
  variedadRotuladaId?: number | null
  categoriaId: number
  calibreIds: number[]
  tipoPalletId?: number | null
  alturaId: number
  cantidadPallets: number
  cajasPorPallet: number
  cajas: number
}

export interface InstructivoEmbalajeCreateInput {
  entidadProductorId: number
  grupoMercadoId: number
  fechaInicioPrograma: Date
  observaciones?: string | null
  detalle: InstructivoEmbalajeDetalleInput[]
}

export interface InstructivoEmbalajeUpdateInput {
  entidadProductorId?: number
  grupoMercadoId?: number
  fechaInicioPrograma?: Date
  observaciones?: string | null
  detalle?: InstructivoEmbalajeDetalleInput[]
}
