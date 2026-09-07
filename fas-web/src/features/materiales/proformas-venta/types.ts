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

export type EstadoProformaMaterial = 'BORRADOR' | 'ENVIADA_VALIDACION' | 'FACTURADA' | 'ANULADA'

export const ESTADO_PROFORMA_MATERIAL_LABELS: Record<EstadoProformaMaterial, string> = {
  BORRADOR: 'Borrador',
  ENVIADA_VALIDACION: 'Enviada a Validación',
  FACTURADA: 'Facturada',
  ANULADA: 'Anulada',
}

export interface CondicionPagoRef {
  id: number
  codigo: string
  descripcion: string
}

export type FechaReferenciaPago = 'FACTURA' | 'ZARPE' | 'ENVIO_DOCUMENTOS'

export interface ProformaMaterialCuotaPagoItem {
  id: number
  fechaReferencia: FechaReferenciaPago
  plazoDias: number
  porcentaje: string | null
  descripcion: string | null
}

export interface ProformaMaterialLineaItem {
  id: number
  articuloId: number
  articulo: MantenedorRef & { unidad: MantenedorRef }
  cantidad: string
  precioUnitario: string
  monto: string
}

export interface ProformaMaterialMovimientoRef {
  id: number
  fechaMovimiento: string
  guiaReferencia: string | null
  bodegaOrigen: MantenedorRef | null
  tipoMovimiento: MantenedorRef
}

export interface ProformaMaterialListItem {
  id: number
  numero: string
  estado: EstadoProformaMaterial
  entidadId: number
  entidad: EntidadRef
  moneda: MantenedorRef
  movimiento: { id: number; fechaMovimiento: string }
  creadoEn: string
}

export interface ProformaMaterialDetalle extends Omit<ProformaMaterialListItem, 'movimiento'> {
  movimientoId: number
  movimiento: ProformaMaterialMovimientoRef
  monedaId: number
  formaPagoId: number | null
  formaPago: MantenedorRef | null
  condicionPagoId: number | null
  condicionPago: CondicionPagoRef | null
  observaciones: string | null
  lineas: ProformaMaterialLineaItem[]
  cuotasPago: ProformaMaterialCuotaPagoItem[]
  creadoEn: string
  creadoPor: string
}

export interface ProformaMaterialListResponse {
  data: ProformaMaterialListItem[]
  meta: { total: number; page: number; limit: number; totalPages: number }
}

export interface ProformaMaterialCreateInput {
  movimientoId: number
  formaPagoId?: number | null
  condicionPagoId?: number | null
  monedaId: number
  observaciones?: string | null
}

export type ProformaMaterialUpdateInput = Partial<Omit<ProformaMaterialCreateInput, 'movimientoId'>>

export interface ProformaMaterialLineaUpdateInput {
  precioUnitario: number
}

export interface ProformaMaterialListFilters {
  page?: number
  limit?: number
  entidadId?: number
  estado?: EstadoProformaMaterial
}
