import type { TipoDteProforma } from '@/lib/tipo-documento-proforma'
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

export type EstadoProformaProductor = 'BORRADOR' | 'ENVIADA_VALIDACION' | 'RECHAZADA' | 'FACTURADA' | 'ANULADA'

export const ESTADO_PROFORMA_PRODUCTOR_LABELS: Record<EstadoProformaProductor, string> = {
  BORRADOR: 'Borrador',
  ENVIADA_VALIDACION: 'Enviada a Validación',
  RECHAZADA: 'Rechazada',
  FACTURADA: 'Facturada',
  ANULADA: 'Anulada',
}

// Estado de emisión: EMITIDA ⟺ la Factura Nacional asociada está APROBADA por el
// SII; PENDIENTE en cualquier otro caso.
export type EstadoEmisionProforma = 'PENDIENTE' | 'EMITIDA'

export const ESTADO_EMISION_LABELS: Record<EstadoEmisionProforma, string> = {
  PENDIENTE: 'Pendiente',
  EMITIDA: 'Emitida',
}

export type FechaReferenciaPago = 'FACTURA' | 'ZARPE' | 'ENVIO_DOCUMENTOS' | 'ARRIBO'

export interface ProformaProductorCuotaPagoItem {
  id: number
  fechaReferencia: FechaReferenciaPago
  plazoDias: number
  porcentaje: string | null
  descripcion: string | null
}

export interface ProformaProductorLineaItem {
  id: number
  glosa: string
  cantidad: string
  precioUnitario: string
  monto: string
}

export interface ProformaProductorListItem {
  id: number
  numero: string
  estado: EstadoProformaProductor
  estadoEmision: EstadoEmisionProforma
  entidadId: number
  entidad: EntidadRef
  moneda: MantenedorRef
  creadoEn: string
}

// El detalle (getById) no calcula estadoEmision (solo el listado lo deriva).
export interface ProformaProductorDetalle extends Omit<ProformaProductorListItem, 'estadoEmision'> {
  monedaId: number
  tipoCambio: string | null
  // 33 Factura Nacional / 34 Factura Exenta (2026-11-09).
  tipoDte: TipoDteProforma
  formaPagoId: number | null
  formaPago: MantenedorRef | null
  condicionPagoId: number | null
  condicionPago: MantenedorRef | null
  conceptoCtaCteId: number | null
  conceptoCtaCte: MantenedorRef | null
  observaciones: string | null
  lineas: ProformaProductorLineaItem[]
  cuotasPago: ProformaProductorCuotaPagoItem[]
  creadoEn: string
  creadoPor: string
}

export interface ProformaProductorListResponse {
  data: ProformaProductorListItem[]
  meta: { total: number; page: number; limit: number; totalPages: number }
}

export interface ProformaProductorLineaInput {
  glosa: string
  cantidad: number
  precioUnitario: number
}

export interface ProformaProductorCreateInput {
  entidadId: number
  monedaId: number
  tipoCambio?: number | null
  formaPagoId?: number | null
  condicionPagoId?: number | null
  conceptoCtaCteId?: number | null
  tipoDte?: TipoDteProforma
  observaciones?: string | null
  lineas: ProformaProductorLineaInput[]
}

export type ProformaProductorUpdateInput = Partial<ProformaProductorCreateInput>

export interface ProformaProductorListFilters {
  page?: number
  limit?: number
  entidadId?: number
  estado?: EstadoProformaProductor
  q?: string
}
