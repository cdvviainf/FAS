export interface RecetaDetalleInput {
  componenteId: number
  cantidadAConsumir: number
}

export interface RecetaCreateInput {
  embalajeId: number
  codigo: string
  descripcion: string
  cantidadAProducir: number
  activo?: boolean
  detalle: RecetaDetalleInput[]
}

export type RecetaUpdateInput = Partial<Omit<RecetaCreateInput, 'embalajeId'>>
