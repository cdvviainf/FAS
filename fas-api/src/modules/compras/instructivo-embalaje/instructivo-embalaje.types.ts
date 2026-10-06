export interface InstructivoEmbalajeDetalleInput {
  articuloId: number
  // Grupo de mercado a nivel de línea (2026-10-05).
  grupoMercadoId: number
  especieId: number
  variedadId: number
  // Segunda variedad opcional, de la misma especie (2026-08-12).
  variedadRotuladaId?: number | null
  categoriaId: number
  calibreIds: number[]
  tipoPalletId?: number | null
  alturaId: number
  // Marca (Etiqueta) editable por línea (2026-10-05).
  etiquetaId?: number | null
  cantidadPallets: number
  cajasPorPallet: number
  cajas: number
  observaciones?: string | null
}

export interface InstructivoEmbalajeCreateInput {
  entidadProductorId: number
  // Exportador (2026-10-05) — Entidad tipo EXPORTADORA, opcional.
  exportadorId?: number | null
  fechaInicioPrograma: Date
  observaciones?: string | null
  detalle: InstructivoEmbalajeDetalleInput[]
}

export interface InstructivoEmbalajeUpdateInput {
  entidadProductorId?: number
  exportadorId?: number | null
  fechaInicioPrograma?: Date
  observaciones?: string | null
  detalle?: InstructivoEmbalajeDetalleInput[]
}
