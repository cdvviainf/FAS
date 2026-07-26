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
