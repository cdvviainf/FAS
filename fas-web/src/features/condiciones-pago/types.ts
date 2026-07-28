export type FechaReferenciaPago = 'FACTURA' | 'ZARPE' | 'ENVIO_DOCUMENTOS'
export type TipoValorCuota = 'PORCENTAJE' | 'MONTO_UNITARIO'

export const FECHA_REFERENCIA_LABELS: Record<FechaReferenciaPago, string> = {
  FACTURA: 'Fecha de Factura',
  ZARPE: 'Fecha de Zarpe',
  ENVIO_DOCUMENTOS: 'Fecha de Envío de Documentos',
}

export interface MantenedorRef {
  id: number
  codigo: string
  descripcion: string
}

export interface CondicionPagoCuota {
  id: number
  fechaReferencia: FechaReferenciaPago
  plazoDias: number
  tipoValor: TipoValorCuota
  porcentaje: string | null
  valorUnitario: string | null
  monedaId: number | null
  moneda: MantenedorRef | null
  unidadId: number | null
  unidad: MantenedorRef | null
  descripcion: string | null
}

export interface CondicionPago {
  id: number
  codigo: string
  descripcion: string
  bloqueado: boolean
  cuotas: CondicionPagoCuota[]
}

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
