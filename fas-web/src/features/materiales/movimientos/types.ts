export interface MovimientoDetalleItem {
  id: number
  articuloId: number
  articulo: { id: number; codigo: string; descripcion: string }
  cantidad: string
  precioUnitario: string | null
}

export interface Movimiento {
  id: number
  tipoMovimientoId: number
  tipoMovimiento: { id: number; codigo: string; descripcion: string; clase: string; emiteDTE: boolean }
  entidadId: number | null
  entidad: { id: number; codigo: string; descripcion: string; razonSocial: string } | null
  fechaRegistro: string
  fechaMovimiento: string
  bodegaOrigenId: number | null
  bodegaOrigen: { id: number; codigo: string; descripcion: string } | null
  bodegaDestinoId: number | null
  bodegaDestino: { id: number; codigo: string; descripcion: string } | null
  guiaReferencia: string | null
  transporteEntidadId: number | null
  transporteEntidad: { id: number; codigo: string; descripcion: string; razonSocial: string } | null
  choferRut: string | null
  choferNombre: string | null
  placaCamion: string | null
  placaRemolque: string | null
  horaSalida: string | null
  horaEstimadaLlegada: string | null
  detalle: MovimientoDetalleItem[]
  usuarioId: string
  creadoEn: string
}

export interface MovimientoDetalleInput {
  articuloId: number
  cantidad: number
  precioUnitario?: number | null
}

export interface MovimientoCreateInput {
  tipoMovimientoId: number
  entidadId?: number | null
  fechaMovimiento: string
  bodegaOrigenId?: number | null
  bodegaDestinoId?: number | null
  guiaReferencia?: string | null
  transporteEntidadId?: number | null
  choferRut?: string | null
  choferNombre?: string | null
  placaCamion?: string | null
  placaRemolque?: string | null
  horaSalida?: string | null
  horaEstimadaLlegada?: string | null
  detalle: MovimientoDetalleInput[]
}

export interface MovimientoListResponse {
  data: Movimiento[]
  meta: { total: number; page: number; limit: number; totalPages: number }
}

export interface MovimientoListFilters {
  tipoMovimientoId?: number
  fechaDesde?: string
  fechaHasta?: string
  bodegaId?: number
  page?: number
  limit?: number
}
