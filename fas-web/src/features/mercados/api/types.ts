export interface Mercado {
  id: number
  codigo: string
  descripcion: string
  descripcionExtranjera?: string | null
  grupoMercadoId: number
  grupoMercado?: { id: number; descripcion: string } | null
  creadoEn: string
  creadoPor: string
}

export interface MercadosResponse {
  mercados: Mercado[]
  total: number
}

export interface MercadoFilters {
  page?: number
  limit?: number
  q?: string
  sort?: string
}

export interface MercadoMutationPayload {
  codigo: string
  descripcion: string
  descripcionExtranjera?: string
  grupoMercadoId: number
}
