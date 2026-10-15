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
  mercadoId: number
  mercado: MantenedorRef
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
  // Fecha de inicio de programa — de ella se deriva la semana ISO (2026-10-14).
  fechaInicioPrograma: string
  creadoEn: string
}

export interface InstructivoEmbalajeDetalle extends InstructivoEmbalajeListItem {
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
  mercadoId: number
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
