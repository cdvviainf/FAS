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

export interface MovimientoListFilters {
  tipoMovimientoId?: number
  fechaDesde?: string
  fechaHasta?: string
  bodegaId?: number
  page?: number
  limit?: number
}
