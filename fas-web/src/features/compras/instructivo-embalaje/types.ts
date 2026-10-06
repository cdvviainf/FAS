export interface MantenedorRef {
  id: number
  codigo: string
  descripcion: string
}

export interface EntidadRef {
  id: number
  codigo: string
  descripcion: string
  razonSocial: string
}

export interface InstructivoEmbalajeDetalleItem {
  id: number
  instructivoId: number
  articuloId: number
  articulo: MantenedorRef & { etiqueta: MantenedorRef | null }
  grupoMercadoId: number
  grupoMercado: MantenedorRef
  especieId: number
  especie: MantenedorRef
  variedadId: number
  variedad: MantenedorRef
  variedadRotuladaId: number | null
  variedadRotulada: MantenedorRef | null
  categoriaId: number
  categoria: MantenedorRef
  calibres: { calibre: MantenedorRef }[]
  tipoPalletId: number | null
  tipoPallet: MantenedorRef | null
  alturaId: number
  altura: MantenedorRef
  etiquetaId: number | null
  etiqueta: MantenedorRef | null
  cantidadPallets: number
  cajasPorPallet: number
  cajas: number
  observaciones: string | null
}

export interface InstructivoEmbalajeListItem {
  id: number
  numero: number
  entidadProductorId: number
  entidadProductor: EntidadRef
  exportadorId: number | null
  exportador: EntidadRef | null
  creadoEn: string
}

export interface InstructivoEmbalajeDetalle extends InstructivoEmbalajeListItem {
  fechaInicioPrograma: string
  observaciones: string | null
  detalle: InstructivoEmbalajeDetalleItem[]
  creadoPor: string
}

export interface InstructivoEmbalajeListResponse {
  data: InstructivoEmbalajeListItem[]
  meta: { total: number; page: number; limit: number; totalPages: number }
}

export interface InstructivoEmbalajeDetalleInput {
  articuloId: number
  grupoMercadoId: number
  especieId: number
  variedadId: number
  variedadRotuladaId: number | null
  categoriaId: number
  calibreIds: number[]
  tipoPalletId: number | null
  alturaId: number
  etiquetaId: number | null
  cantidadPallets: number
  cajasPorPallet: number
  cajas: number
  observaciones: string | null
}

export interface InstructivoEmbalajeCreateInput {
  entidadProductorId: number
  exportadorId?: number | null
  fechaInicioPrograma: string
  observaciones?: string | null
  detalle: InstructivoEmbalajeDetalleInput[]
}

export interface InstructivoEmbalajeListFilters {
  page?: number
  limit?: number
  entidadProductorId?: number
}

export interface InstructivoEmbalajeUpdateInput {
  entidadProductorId?: number
  exportadorId?: number | null
  fechaInicioPrograma?: string
  observaciones?: string | null
  detalle?: InstructivoEmbalajeDetalleInput[]
}
