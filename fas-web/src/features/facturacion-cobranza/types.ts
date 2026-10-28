// Tipos del módulo Cobranza / Pagos (Ciclo 2, Docs/cobranza.md).

export type TipoFacturaCobranza = 'EXPORTACION' | 'NACIONAL'
export type MedioPago = 'TRANSFERENCIA' | 'CHEQUE' | 'EFECTIVO' | 'OTRO'
export type EstadoCobranza = 'SIN_CUOTAS' | 'PENDIENTE' | 'PARCIAL' | 'PAGADA' | 'VENCIDA'
export type EstadoCuota = 'PENDIENTE' | 'PARCIAL' | 'PAGADA' | 'VENCIDA'

export interface MonedaRef {
  id: number
  codigo: string
  descripcion?: string
}

export interface CuotaCartera {
  id: number
  numeroCuota: number
  montoCuota: string
  saldoPendiente: string
  montoPagado: string
  fechaVencimiento: string | null
  estado: EstadoCuota
}

export interface DocumentoPendiente {
  tipoFactura: TipoFacturaCobranza
  id: number
  codigo: string
  moneda: MonedaRef
  montoTotal: string
  estadoCobranza: EstadoCobranza | null
  fechaEmision: string | null
  saldoPendiente: number
  cuotas: CuotaCartera[]
}

export interface SaldoAFavor {
  id: number
  montoOriginal: string
  montoDisponible: string
  fecha: string
  moneda: MonedaRef
  pagoOrigen: { id: number; codigo: string } | null
}

export interface PagoAplicacionRef {
  id: number
  montoAplicado: string
  tipoCambioAplicado: string
  facturaExportacionId: number | null
  facturaExportacion: { codigo: string } | null
  facturaNacionalId: number | null
  facturaNacional: { codigo: string } | null
}

export interface Pago {
  id: number
  codigo: string
  fecha: string
  monto: string
  medioPago: MedioPago
  referencia: string | null
  observacion: string | null
  cliente: { id: number; codigo: string; descripcion: string; razonSocial: string | null }
  moneda: MonedaRef
  aplicaciones: PagoAplicacionRef[]
  saldoAFavorGenerado: { id: number; montoOriginal: string; montoDisponible: string } | null
}

export interface PagosListResponse {
  data: Pago[]
  meta: { total: number; page: number; limit: number; totalPages: number }
}

// Payload de POST /pagos.
export interface PagoAplicacionInput {
  tipoFactura: TipoFacturaCobranza
  facturaId: number
  montoAplicado: number
  tipoCambio: number
}

export interface CrearPagoInput {
  clienteId: number
  fecha: string
  monto: number
  monedaId: number
  medioPago: MedioPago
  referencia?: string | null
  observacion?: string | null
  aplicaciones: PagoAplicacionInput[]
}

export interface AplicarSaldoInput {
  tipoFactura: TipoFacturaCobranza
  facturaId: number
  monto: number
}

export interface ClienteOption {
  id: number
  codigo: string
  descripcion: string
  razonSocial: string | null
}
