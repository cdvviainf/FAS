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
  cantidadPallets: number
  cajasPorPallet: number
  cajas: number
}

export interface InstructivoEmbalajeListItem {
  id: number
  numero: number
  entidadProductorId: number
  entidadProductor: EntidadRef
  creadoEn: string
}

export interface InstructivoEmbalajeDetalle extends InstructivoEmbalajeListItem {
  grupoMercadoId: number
  grupoMercado: MantenedorRef
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
  especieId: number
  variedadId: number
  variedadRotuladaId: number | null
  categoriaId: number
  calibreIds: number[]
  tipoPalletId: number | null
  alturaId: number
  cantidadPallets: number
  cajasPorPallet: number
  cajas: number
}

export interface InstructivoEmbalajeCreateInput {
  entidadProductorId: number
  grupoMercadoId: number
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
  grupoMercadoId?: number
  fechaInicioPrograma?: string
  observaciones?: string | null
  detalle?: InstructivoEmbalajeDetalleInput[]
}
