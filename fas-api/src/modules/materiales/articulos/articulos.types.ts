export type TipoArticulo = 'EMBALAJE' | 'ENVASE' | 'MATERIAL_EMBALAJE' | 'SERVICIO' | 'GRANEL'
export type TipoCosteo = 'PROMEDIO_PONDERADO' | 'ESTANDAR'

export interface CodigoEquivalenteInput {
  codigo: string
  descripcion?: string | null
}

export interface ArticuloCreateInput {
  tipo: TipoArticulo
  codigo: string
  descripcion: string
  descripcionComercial?: string | null
  descripcionExtranjera?: string | null
  unidadId: number
  tipoCosteo: TipoCosteo
  valorEstandar?: number | null
  stockCritico?: number | null
  activo?: boolean
  // Solo SERVICIO; se normalizan en el service. exento: true=exento IVA, false=afecto.
  facturable?: boolean
  exento?: boolean
  controlaStock?: boolean // calculado por el service a partir de tipoCosteo (R3)
  etiquetaId?: number | null
  // Etiquetas adicionales permitidas (2026-10-12). En update, si viene definida
  // reemplaza toda la lista; si es undefined, no se toca.
  etiquetaIdsAdicionales?: number[]
  kgNetoEnvase?: number | null
  kgBrutoEnvase?: number | null
  especieId?: number | null
  // Lista de códigos equivalentes/alternativos (2026-09-28). En update, si viene
  // definida reemplaza toda la lista; si es undefined, no se toca.
  codigosEquivalentes?: CodigoEquivalenteInput[]
}

export type ArticuloUpdateInput = Partial<ArticuloCreateInput>

export interface ArticuloListFilters {
  q?: string
  tipo?: TipoArticulo
  especieId?: number
  activo?: boolean
  facturable?: boolean
  page?: number
  limit?: number
  sort?: string
}
