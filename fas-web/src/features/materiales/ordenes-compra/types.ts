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

export type EstadoOrdenCompraMaterial = 'BORRADOR' | 'EMITIDA' | 'RECEPCIONADA'

export const ESTADO_OCM_LABELS: Record<EstadoOrdenCompraMaterial, string> = {
  BORRADOR: 'Borrador',
  EMITIDA: 'Emitida',
  RECEPCIONADA: 'Recepcionada',
}

export interface CondicionPagoRef {
  id: number
  codigo: string
  descripcion: string
}

export type FechaReferenciaPago = 'FACTURA' | 'ZARPE' | 'ENVIO_DOCUMENTOS'

export interface OrdenCompraMaterialCuotaPagoItem {
  id: number
  fechaReferencia: FechaReferenciaPago
  plazoDias: number
  porcentaje: string | null
  descripcion: string | null
}

export interface OrdenCompraMaterialLineaItem {
  id: number
  articuloId: number
  articulo: MantenedorRef & { unidad: MantenedorRef }
  cantidad: string
  precioUnitario: string
  monto: string
}

export type EstadoMovimientoVinculado = 'BORRADOR' | 'CONFIRMADO'

export interface OrdenCompraMaterialMovimientoVinculo {
  id: number
  estado: EstadoMovimientoVinculado
  fechaMovimiento: string
}

export interface OrdenCompraMaterialListItem {
  id: number
  numero: string
  fecha: string
  estado: EstadoOrdenCompraMaterial
  entidadProveedorId: number
  entidadProveedor: EntidadRef
  moneda: MantenedorRef
}

export interface OrdenCompraMaterialDetalle extends OrdenCompraMaterialListItem {
  monedaId: number
  formaPagoId: number | null
  formaPago: MantenedorRef | null
  condicionPagoId: number | null
  condicionPago: CondicionPagoRef | null
  observaciones: string | null
  lineas: OrdenCompraMaterialLineaItem[]
  cuotasPago: OrdenCompraMaterialCuotaPagoItem[]
  movimientos: OrdenCompraMaterialMovimientoVinculo[]
  creadoEn: string
  creadoPor: string
}

export interface OrdenCompraMaterialListResponse {
  data: OrdenCompraMaterialListItem[]
  meta: { total: number; page: number; limit: number; totalPages: number }
}

export interface OrdenCompraMaterialCreateInput {
  entidadProveedorId: number
  fecha?: string
  formaPagoId?: number | null
  condicionPagoId?: number | null
  monedaId: number
  observaciones?: string | null
}

export type OrdenCompraMaterialUpdateInput = Partial<OrdenCompraMaterialCreateInput>

export interface OrdenCompraMaterialLineaInput {
  articuloId: number
  cantidad: number
  precioUnitario: number
}
