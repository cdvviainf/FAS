export interface MantenedorSimple {
  id: number
  codigo: string
  descripcion: string
  descripcionExtranjera?: string | null
  // Código de la tabla de Aduana del SII (DTE 110) — solo algunos mantenedores.
  codigoAduana?: string | null
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
  mercadoId?: number
  tipoEmbarqueId?: number
  tipoDefectoId?: number
  grupoDefectoId?: number
  contexto?: 'origen' | 'destino'
  soloActivos?: boolean
  // Orden server-side: JSON [{ id, desc }] (getSortingStateParser)
  sort?: string
}

export interface MantenedorSimpleCreateInput {
  codigo: string
  descripcion: string
  descripcionExtranjera?: string
  codigoAduana?: string | null
  bloqueado?: boolean
  // FK fields (optional, used when creating FK models)
  regionId?: number
  provinciaId?: number
  especieId?: number
  grupoVariedadId?: number | null
  tipoParametroId?: number
  grupoMercadoId?: number
  paisId?: number
  mercadoId?: number
  tipoEmbarqueId?: number
  // Catálogo de defectos (2026-10-06)
  tipoDefectoId?: number   // GrupoDefecto
  grupoDefectoId?: number  // Defecto
  especieIds?: number[]    // Defecto (N:M, validez por especie)
  orden?: number
  esPaisNacional?: boolean
  puedeSerOrigen?: boolean
  // Moneda
  esMonedaBase?: boolean
  decimales?: number
  // Puerto
  latitud?: number | null
  longitud?: number | null
  // ConceptoCtaCte
  naturaleza?: string
}
