export type EstadoFacturaNacional = 'BORRADOR' | 'APROBADA' | 'RECHAZADA' | 'ANULADA'
export type OrigenFacturaNacional = 'PROFORMA_MATERIAL' | 'PROFORMA_PRODUCTOR' | 'VENTA_NACIONAL'

// Línea editable del borrador (el usuario ajusta descripción/precio/exento).
export interface FacturaNacionalLineaInput {
  descripcion: string
  articuloId?: number | null
  cantidad: number
  precioUnitario: number
  exento: boolean
}

export interface FacturaNacionalActualizarInput {
  fechaDocumento?: string | null // YYYY-MM-DD
  observaciones?: string | null
  lineas?: FacturaNacionalLineaInput[]
}

export interface FacturasNacionalListFilters {
  page?: number
  limit?: number
  estado?: EstadoFacturaNacional
  q?: string
}
