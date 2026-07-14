export interface MantenedorSimple {
  id: number
  codigo: string
  descripcion: string
  descripcionExtranjera?: string | null
  bloqueado?: boolean
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
  // FK filters (optional, passed through to API)
  regionId?: number
  provinciaId?: number
  especieId?: number
  grupoVariedadId?: number
  tipoParametroId?: number
  grupoMercadoId?: number
  paisId?: number
  tipoEmbarqueId?: number
  contexto?: 'origen' | 'destino'
  soloActivos?: boolean
}

export interface MantenedorSimpleCreateInput {
  codigo: string
  descripcion: string
  descripcionExtranjera?: string
  bloqueado?: boolean
  // FK fields (optional, used when creating FK models)
  regionId?: number
  provinciaId?: number
  especieId?: number
  grupoVariedadId?: number | null
  tipoParametroId?: number
  grupoMercadoId?: number
  paisId?: number
  tipoEmbarqueId?: number
  orden?: number
  esPaisOrigen?: boolean
  // Moneda
  esMonedaBase?: boolean
  decimales?: number
  // Puerto
  latitud?: number | null
  longitud?: number | null
  // ConceptoCtaCte
  naturaleza?: string
}
