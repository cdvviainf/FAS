export type FechaReferenciaPago = 'FACTURA' | 'ZARPE' | 'ENVIO_DOCUMENTOS' | 'ARRIBO'
export type TipoValorCuota = 'PORCENTAJE' | 'MONTO_UNITARIO'
export type TipoCondicionPago = 'COMPRA' | 'VENTA'

export interface CondicionPagoCuotaInput {
  fechaReferencia: FechaReferenciaPago
  plazoDias: number
  tipoValor: TipoValorCuota
  porcentaje?: number | null
  valorUnitario?: number | null
  monedaId?: number | null
  unidadId?: number | null
  descripcion?: string
}

export interface CondicionPagoCreateInput {
  codigo: string
  descripcion: string
  tipo: TipoCondicionPago
  bloqueado?: boolean
  // Código SII de Forma de Pago de Exportación (FmaPagExp), DTE 110 (2026-10-13).
  codigoAduana?: string | null
  cuotas: CondicionPagoCuotaInput[]
}

export type CondicionPagoUpdateInput = Partial<Omit<CondicionPagoCreateInput, 'codigo'>>
