export interface MantenedorRef {
  id: number
  codigo: string
  descripcion: string
}

export interface NotaVentaCalibreItem {
  id: number
  calibreId: number
  calibre: MantenedorRef
}

export interface NotaVentaDetalleItem {
  id: number
  notaVentaId: number
  fechaCompromiso: string
  especieId: number
  especie: MantenedorRef
  variedadId: number
  variedad: MantenedorRef
  articuloId: number
  articulo: MantenedorRef
  categoriaId: number | null
  categoria: MantenedorRef | null
  tipoPalletId: number | null
  tipoPallet: MantenedorRef | null
  cantidadPallets: number
  cajasPorPallet: number
  cajas: number
  precio: string
  calibres: NotaVentaCalibreItem[]
}

export interface NotaVentaListItem {
  id: number
  folio: number
  fecha: string
  clienteId: number
  cliente: { id: number; codigo: string; descripcion: string; razonSocial: string }
  mercado: MantenedorRef
  moneda: MantenedorRef
}

export interface NotaVentaDetalle extends NotaVentaListItem {
  compradorId: number | null
  comprador: { id: number; codigo: string; descripcion: string; razonSocial: string } | null
  notifyId: number | null
  notify: { id: number; codigo: string; descripcion: string; razonSocial: string } | null
  clienteFinalId: number | null
  clienteFinal: { id: number; codigo: string; descripcion: string; razonSocial: string } | null
  tipoEmbarqueId: number
  tipoEmbarque: MantenedorRef
  mercadoId: number
  paisDestinoId: number
  paisDestino: MantenedorRef
  puertoDestinoId: number | null
  puertoDestino: MantenedorRef | null
  direccionId: number | null
  direccion: { id: number; codigo: string; direccion: string } | null
  direccionDetalle: string | null
  monedaId: number
  observaciones: string | null
  detalles: NotaVentaDetalleItem[]
}

export interface NotaVentaListResponse {
  data: NotaVentaListItem[]
  meta: { total: number; page: number; limit: number; totalPages: number }
}

export interface NotaVentaCreateInput {
  fecha: string
  clienteId: number
  compradorId?: number | null
  notifyId?: number | null
  clienteFinalId?: number | null
  tipoEmbarqueId: number
  mercadoId: number
  paisDestinoId: number
  puertoDestinoId?: number | null
  direccionId?: number | null
  direccionDetalle?: string | null
  monedaId: number
  observaciones?: string | null
}

export type NotaVentaUpdateInput = Partial<NotaVentaCreateInput>

export interface NotaVentaDetalleCreateInput {
  fechaCompromiso: string
  especieId: number
  variedadId: number
  articuloId: number
  categoriaId?: number | null
  tipoPalletId?: number | null
  cantidadPallets: number
  cajasPorPallet: number
  cajas: number
  precio: number
  calibreIds: number[]
}
