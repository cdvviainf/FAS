export type TipoArticulo = 'EMBALAJE' | 'ENVASE' | 'MATERIAL_EMBALAJE' | 'SERVICIO'
export type TipoCosteo = 'PROMEDIO_PONDERADO' | 'ESTANDAR'

export interface ArticuloCreateInput {
  tipo: TipoArticulo
  codigo: string
  descripcion: string
  descripcionExtranjera?: string | null
  unidadId: number
  tipoCosteo: TipoCosteo
  valorEstandar?: number | null
  stockCritico?: number | null
  activo?: boolean
  controlaStock?: boolean // calculado por el service a partir de tipoCosteo (R3)
}

export type ArticuloUpdateInput = Partial<ArticuloCreateInput>

export interface ArticuloListFilters {
  q?: string
  tipo?: TipoArticulo
  activo?: boolean
  page?: number
  limit?: number
}
