// Monitor DTE (2026-11-07): documentos electrónicos firmados y su estado SII.
export type EstadoSiiDte = 'PENDIENTE' | 'ACEPTADO' | 'RECHAZADO'

export const ESTADO_SII_LABELS: Record<EstadoSiiDte, string> = {
  PENDIENTE: 'Pendiente',
  ACEPTADO: 'Aceptado',
  RECHAZADO: 'Rechazado',
}

export const TIPOS_DTE: Array<{ codigo: number; nombre: string }> = [
  { codigo: 33, nombre: 'Factura electrónica (33)' },
  { codigo: 34, nombre: 'Factura exenta electrónica (34)' },
  { codigo: 52, nombre: 'Guía de despacho electrónica (52)' },
  { codigo: 61, nombre: 'Nota de crédito electrónica (61)' },
  { codigo: 110, nombre: 'Factura de exportación electrónica (110)' },
  { codigo: 112, nombre: 'Nota de crédito de exportación (112)' },
]

export interface MonitorDteFila {
  id: number
  tipoDte: number
  tipoNombre: string
  folio: number
  fechaEmision: string | null
  generadoEn: string | null
  rutReceptor: string
  razonSocialReceptor: string | null
  montoTotal: string | null
  moneda: string | null
  origen: { tipo: string; etiqueta: string; id: number; codigo: string | null; ruta: string | null }
  estadoSii: EstadoSiiDte
  estadoSiiGlosa: string | null
  estadoSiiConsultadoEn: string | null
}

export interface MonitorDteFiltros {
  page?: number
  limit?: number
  tipoDte?: number
  estadoSii?: EstadoSiiDte
  fechaDesde?: string
  fechaHasta?: string
  folio?: number
  receptor?: string
}

export interface MonitorDteListResponse {
  data: MonitorDteFila[]
  meta: { total: number; page: number; limit: number; totalPages: number }
}
