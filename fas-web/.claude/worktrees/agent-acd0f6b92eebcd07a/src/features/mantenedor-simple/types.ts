export interface MantenedorSimple {
  id: number
  codigo: string
  descripcion: string
  descripcionExtranjera?: string | null
  creadoEn: string
  creadoPor: string
}

export interface MantenedorSimpleListResponse {
  data: MantenedorSimple[]
  meta: { total: number; page: number; limit: number; totalPages: number }
}

export interface MantenedorSimpleFilters {
  q?: string
  page?: number
  limit?: number
}

export interface MantenedorSimpleCreateInput {
  codigo: string
  descripcion: string
  descripcionExtranjera?: string
}
