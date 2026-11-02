export interface ProformaProductorLineaInput {
  articuloId: number
  cantidad: number
  precioUnitario: number
  exento: boolean
}

export interface ProformaProductorCreateInput {
  entidadId: number
  monedaId: number
  formaPagoId?: number | null
  condicionPagoId?: number | null
  conceptoCtaCteId?: number | null
  observaciones?: string | null
  lineas: ProformaProductorLineaInput[]
}

export type ProformaProductorUpdateInput = Partial<ProformaProductorCreateInput>

export interface ProformaProductorListFilters {
  entidadId?: number
  estado?: 'BORRADOR' | 'ENVIADA_VALIDACION' | 'RECHAZADA' | 'FACTURADA' | 'ANULADA'
  q?: string
  page?: number
  limit?: number
}
