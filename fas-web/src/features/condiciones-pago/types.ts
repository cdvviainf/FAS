export interface CondicionPagoCuota {
  id: number
  porcentaje: string
  plazoDias: number
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
  porcentaje: number
  plazoDias: number
  descripcion?: string
}

export interface CondicionPagoCreateInput {
  codigo: string
  descripcion: string
  bloqueado?: boolean
  cuotas: CondicionPagoCuotaInput[]
}

export type CondicionPagoUpdateInput = Partial<Omit<CondicionPagoCreateInput, 'codigo'>>
