import type { TipoEntidad } from '@/features/entidades/types'

export type EstadoMovimiento = 'BORRADOR' | 'CONFIRMADO'

export const ESTADO_MOVIMIENTO_LABELS: Record<EstadoMovimiento, string> = {
  BORRADOR: 'Borrador',
  CONFIRMADO: 'Confirmado',
}

export interface MovimientoDetalleItem {
  id: number
  articuloId: number
  articulo: { id: number; codigo: string; descripcion: string }
  cantidad: string
  precioUnitario: string | null
}

export interface Movimiento {
  id: number
  estado: EstadoMovimiento
  tipoMovimientoId: number
  tipoMovimiento: {
    id: number; codigo: string; descripcion: string; clase: string
    emiteDTE: boolean; requierePrecio: boolean; entidadRelacionada: TipoEntidad | null
  }
  entidadId: number | null
  entidad: { id: number; codigo: string; descripcion: string; razonSocial: string } | null
  // Vincula el ingreso a stock con la Orden de Compra de Materiales que lo
  // autoriza (materiales.md R22) — solo aplica a movimientos clase ENTRADA.
  ordenCompraMaterialId: number | null
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

// Cabecera únicamente — el tipo de movimiento queda fijo tras crear (ver
// movimientos.types.ts en fas-api); si se eligió mal, se elimina el borrador
// y se crea uno nuevo.
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

export interface MovimientoDetalleInput {
  articuloId: number
  cantidad: number
  precioUnitario?: number | null
}

export interface MovimientoListResponse {
  data: Movimiento[]
  meta: { total: number; page: number; limit: number; totalPages: number }
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
