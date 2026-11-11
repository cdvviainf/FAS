export type EstadoSolicitudPago = 'SOLICITADA' | 'PAGADA' | 'ANULADA'

export const ESTADO_SOLICITUD_PAGO_LABELS: Record<EstadoSolicitudPago, string> = {
  SOLICITADA: 'Solicitada',
  PAGADA: 'Pagada',
  ANULADA: 'Anulada',
}

export const ITEM_SOLICITUD_PAGO = 'PROD_SOLICITUD_PAGO'
export const ITEM_SOLICITUD_PAGO_CONFIRMAR = 'PROD_SOLICITUD_PAGO_CONFIRMAR'

interface Ref {
  id: number
  codigo: string
  descripcion: string
}

export type FechaReferenciaPago = 'FACTURA' | 'ZARPE' | 'ENVIO_DOCUMENTOS' | 'ARRIBO'

export interface DetallePalletDespachado {
  palletId: number
  numeroPallet: string
  especie: string
  variedad: string
  categoria: string
  calibre: string
  embalaje: string
  etiqueta: string | null
  cajas: number
  precio: number | null
  monto: number
  pendiente: string | null
}

export interface CuotaDespachada {
  ordenCompraCuotaPagoId: number | null
  numeroCuota: number
  descripcion: string
  fechaReferencia: FechaReferenciaPago
  plazoDias: number
  fechaVencimiento: string | null
  montoCalculado: number
  solicitado: number
  saldo: number
  bloqueada: boolean
}

export interface GrupoDespachado {
  ordenCompra: { id: number; numero: string; moneda: Ref; monedaId: number; condicionPago: Ref | null }
  embarque: { id: number; numeroInstructivo: string; fechaZarpe: string | null; fechaArribo: string | null }
  pallets: number
  cajas: number
  kilos: number | null
  monto: number
  bloqueos: string[]
  detalle: DetallePalletDespachado[]
  cuotas: CuotaDespachada[]
}

export interface SolicitudPagoLinea {
  id: number
  ordenCompraId: number
  ordenCompra: { id: number; numero: string }
  embarqueId: number
  embarque: { id: number; numeroInstructivo: string }
  ordenCompraCuotaPagoId: number | null
  ordenCompraCuotaPago: { descripcion: string | null; fechaReferencia: FechaReferenciaPago; plazoDias: number } | null
  numeroCuota: number
  fechaVencimiento: string | null
  montoCalculado: string
  montoSolicitado: string
  numeroFactura: string | null
  movimientoCcId: number | null
  movimientoAnulacionCcId: number | null
}

export interface SolicitudPago {
  id: number
  numero: string
  fecha: string
  estado: EstadoSolicitudPago
  entidadProductorId: number
  entidadProductor: { id: number; codigo: string; razonSocial: string; identificador?: string | null }
  moneda: Ref
  temporada?: Ref
  observaciones: string | null
  montoTotal: string
  fechaPago: string | null
  numeroTransferencia: string | null
  conceptoCtaCte?: { id: number; codigo: string; descripcion: string } | null
  pagadoEn: string | null
  anuladoEn: string | null
  creadoEn: string
  lineas?: SolicitudPagoLinea[]
  _count?: { lineas: number }
}

export interface SolicitudPagoLineaInput {
  ordenCompraId: number
  embarqueId: number
  ordenCompraCuotaPagoId: number | null
  montoSolicitado: number
}

export interface SolicitudPagoListResponse {
  data: SolicitudPago[]
  meta: { total: number; page: number; limit: number; totalPages: number }
}
