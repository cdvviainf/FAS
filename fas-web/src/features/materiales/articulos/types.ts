export type TipoArticulo = 'EMBALAJE' | 'ENVASE' | 'MATERIAL_EMBALAJE' | 'SERVICIO'
export type TipoCosteo = 'PROMEDIO_PONDERADO' | 'ESTANDAR'

export const TIPO_ARTICULO_LABELS: Record<TipoArticulo, string> = {
  EMBALAJE: 'Embalaje',
  ENVASE: 'Envase',
  MATERIAL_EMBALAJE: 'Material de Embalaje',
  SERVICIO: 'Servicio',
}

export const TIPO_COSTEO_LABELS: Record<TipoCosteo, string> = {
  PROMEDIO_PONDERADO: 'Promedio Ponderado',
  ESTANDAR: 'Estándar',
}

export interface SaldoBodega {
  bodegaId: number
  bodega: { id: number; codigo: string; descripcion: string }
  cantidad: string
  costoPromedio: string
}

export interface Articulo {
  id: number
  tipo: TipoArticulo
  codigo: string
  descripcion: string
  descripcionExtranjera: string | null
  unidadId: number
  unidad: { id: number; codigo: string; descripcion: string }
  tipoCosteo: TipoCosteo
  valorEstandar: string | null
  controlaStock: boolean
  stockCritico: string | null
  activo: boolean
  creadoEn: string
  saldos?: SaldoBodega[]
}

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
}

export type ArticuloUpdateInput = Partial<Omit<ArticuloCreateInput, 'codigo'>>

export interface ArticuloListResponse {
  data: Articulo[]
  meta: { total: number; page: number; limit: number; totalPages: number }
}

export interface ArticuloListFilters {
  q?: string
  tipo?: TipoArticulo
  activo?: boolean
  page?: number
  limit?: number
}

export interface DocumentoArticulo {
  id: number
  nombre: string
  mime: string
  tamano: number
  subidoPor: string
  creadoEn: string
}
