export interface ProformaMaterialCreateInput {
  movimientoId: number
  formaPagoId?: number | null
  condicionPagoId?: number | null
  monedaId: number
  observaciones?: string | null
}

export type ProformaMaterialUpdateInput = Partial<Omit<ProformaMaterialCreateInput, 'movimientoId'>>

export interface ProformaMaterialLineaUpdateInput {
  precioUnitario: number
}

export interface ProformaMaterialListFilters {
  entidadId?: number
  estado?: 'BORRADOR' | 'ENVIADA_VALIDACION' | 'FACTURADA' | 'ANULADA'
  page?: number
  limit?: number
}
