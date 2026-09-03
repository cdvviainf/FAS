export type EstadoMovimiento = 'BORRADOR' | 'CONFIRMADO'

export interface MovimientoDetalleInput {
  articuloId: number
  cantidad: number
  precioUnitario?: number | null
}

// Cabecera únicamente — el tipo de movimiento queda fijo tras crear (define
// bodegas/entidad/DTE de todo el movimiento); si se eligió mal, se borra el
// borrador y se crea uno nuevo en vez de revalidar retroactivamente las
// líneas ya cargadas.
export interface MovimientoCreateInput {
  tipoMovimientoId: number
  fechaMovimiento: string
}

export interface MovimientoUpdateInput {
  entidadId?: number | null
  // Solo aplicable a movimientos clase ENTRADA — vincula el ingreso a stock
  // con la Orden de Compra de Materiales que lo autoriza (materiales.md R22).
  ordenCompraMaterialId?: number | null
  fechaMovimiento?: string
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
}

export interface MovimientoListFilters {
  tipoMovimientoId?: number
  estado?: EstadoMovimiento
  fechaDesde?: string
  fechaHasta?: string
  bodegaId?: number
  page?: number
  limit?: number
}
