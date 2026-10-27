export interface RecetaComponente {
  id: number
  codigo: string
  descripcion: string
  tipo: string
}

export interface RecetaDetalleItem {
  id: number
  componenteId: number
  componente: RecetaComponente
  cantidadAConsumir: string
}

export interface Receta {
  id: number
  embalajeId: number
  embalaje: { id: number; codigo: string; descripcion: string }
  codigo: string
  descripcion: string
  cantidadAProducir: string
  activo: boolean
  detalle: RecetaDetalleItem[]
}

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

export interface RecetaListFilters {
  q?: string
  page?: number
  limit?: number
}

export interface RecetaListResponse {
  data: Receta[]
  meta: { total: number; page: number; limit: number; totalPages: number }
}
