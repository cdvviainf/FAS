// Tipos del registro de Pagos (Ciclo 2, Docs/cobranza.md §5-§6).

export type TipoFacturaCobranza = 'EXPORTACION' | 'NACIONAL'

export interface PagoAplicacionInput {
  tipoFactura: TipoFacturaCobranza
  facturaId: number
  // Monto aplicado EN LA MONEDA DE LA FACTURA.
  montoAplicado: number
  // Tipo de cambio pago→factura (montoAplicado = montoConsumidoDelPago ×
  // tipoCambio). 1 cuando pago y factura comparten moneda.
  tipoCambio: number
}

export interface CrearPagoInput {
  clienteId: number
  fecha: string // YYYY-MM-DD
  monto: number
  monedaId: number
  medioPago: 'TRANSFERENCIA' | 'CHEQUE' | 'EFECTIVO' | 'OTRO'
  referencia?: string | null
  observacion?: string | null
  aplicaciones: PagoAplicacionInput[]
}

export interface AplicarSaldoAFavorInput {
  tipoFactura: TipoFacturaCobranza
  facturaId: number
  monto: number
}

export interface PagosListFilters {
  clienteId?: number
  desde?: string
  hasta?: string
  page: number
  limit: number
}
