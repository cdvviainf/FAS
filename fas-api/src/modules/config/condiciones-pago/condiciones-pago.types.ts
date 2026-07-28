export type FechaReferenciaPago = 'FACTURA' | 'ZARPE' | 'ENVIO_DOCUMENTOS'
export type TipoValorCuota = 'PORCENTAJE' | 'MONTO_UNITARIO'

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
  bloqueado?: boolean
  cuotas: CondicionPagoCuotaInput[]
}

export type CondicionPagoUpdateInput = Partial<Omit<CondicionPagoCreateInput, 'codigo'>>
