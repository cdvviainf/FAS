export type ModuloSistema = 'MATERIALES' | 'FRUTA'
export type ClaseMovimiento = 'ENTRADA' | 'SALIDA' | 'TRASLADO'

export const CLASE_MOVIMIENTO_LABELS: Record<ClaseMovimiento, string> = {
  ENTRADA: 'Entrada',
  SALIDA: 'Salida',
  TRASLADO: 'Traslado',
}

export const MODULO_SISTEMA_LABELS: Record<ModuloSistema, string> = {
  MATERIALES: 'Materiales',
  FRUTA: 'Fruta',
}

export const TIPO_ENTIDAD_OPTIONS = [
  'CLIENTE_NACIONAL', 'CLIENTE_EXTRANJERO', 'NOTIFY', 'CONSIGNATARIO', 'NAVIERA',
  'AGENTE_ADUANA', 'COMPANIA_EMBARQUE', 'PROVEEDOR', 'EMPRESA_TRANSPORTE',
  'PRODUCTOR', 'EXPORTADORA', 'PLANTA',
] as const
export type TipoEntidad = (typeof TIPO_ENTIDAD_OPTIONS)[number]

export interface TipoMovimiento {
  id: number
  codigo: string
  descripcion: string
  modulos: ModuloSistema[]
  clase: ClaseMovimiento
  requierePrecio: boolean
  entidadRelacionada: TipoEntidad | null
  emiteDTE: boolean
  activo: boolean
}

export interface TipoMovimientoCreateInput {
  codigo: string
  descripcion: string
  modulos: ModuloSistema[]
  clase: ClaseMovimiento
  requierePrecio?: boolean
  entidadRelacionada?: TipoEntidad | null
  emiteDTE?: boolean
  activo?: boolean
}

export type TipoMovimientoUpdateInput = Partial<Omit<TipoMovimientoCreateInput, 'codigo'>>

export interface TipoMovimientoListResponse {
  data: TipoMovimiento[]
  meta: { total: number; page: number; limit: number; totalPages: number }
}

export interface TipoMovimientoListFilters {
  modulo?: ModuloSistema
  clase?: ClaseMovimiento
  activo?: boolean
  page?: number
  limit?: number
}
