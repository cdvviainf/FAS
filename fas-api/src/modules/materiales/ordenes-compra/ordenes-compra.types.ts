export interface OrdenCompraMaterialLineaInput {
  articuloId: number
  cantidad: number
  precioUnitario: number
}

export interface OrdenCompraMaterialCreateInput {
  entidadProveedorId: number
  fecha?: Date
  formaPagoId?: number | null
  condicionPagoId?: number | null
  monedaId: number
  observaciones?: string | null
}

export type OrdenCompraMaterialUpdateInput = Partial<OrdenCompraMaterialCreateInput>

export type OrdenCompraMaterialLineaCreateInput = OrdenCompraMaterialLineaInput
export type OrdenCompraMaterialLineaUpdateInput = OrdenCompraMaterialLineaInput
