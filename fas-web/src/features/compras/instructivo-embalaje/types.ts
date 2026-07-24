export interface MantenedorRef {
  id: number
  codigo: string
  descripcion: string
}

export interface InstructivoEmbalajeDetalleItem {
  id: number
  instructivoId: number
  articuloId: number
  articulo: MantenedorRef
  especieId: number
  especie: MantenedorRef
  variedadId: number
  variedad: MantenedorRef
  categoriaId: number
  categoria: MantenedorRef
  calibreMinId: number
  calibreMin: MantenedorRef
  calibreMaxId: number
  calibreMax: MantenedorRef
  cantidadPallets: number
  cajasPorPallet: number
}

export interface InstructivoEmbalajeListItem {
  id: number
  numero: number
  notaVentaId: number
  notaVenta: { id: number; folio: number }
  creadoEn: string
}

export interface InstructivoEmbalajeDetalle extends InstructivoEmbalajeListItem {
  notaVenta: { id: number; folio: number; cliente: { id: number; descripcion: string; razonSocial: string } }
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
