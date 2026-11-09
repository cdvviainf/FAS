export interface ProformaProductorLineaInput {
  glosa: string
  cantidad: number
  precioUnitario: number
}

export interface ProformaProductorCreateInput {
  entidadId: number
  monedaId: number
  // CLP por 1 unidad de la moneda — obligatorio si moneda ≠ CLP (para convertir
  // la Factura Nacional a CLP). null cuando es CLP.
  tipoCambio?: number | null
  formaPagoId?: number | null
  condicionPagoId?: number | null
  conceptoCtaCteId?: number | null
  tipoDte?: 33 | 34
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
