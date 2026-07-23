export type ModuloSistema = 'MATERIALES' | 'FRUTA'
export type ClaseMovimiento = 'ENTRADA' | 'SALIDA' | 'TRASLADO'
export type TipoEntidad =
  | 'CLIENTE_NACIONAL' | 'CLIENTE_EXTRANJERO' | 'NOTIFY' | 'CONSIGNATARIO' | 'NAVIERA'
  | 'AGENTE_ADUANA' | 'COMPANIA_EMBARQUE' | 'PROVEEDOR' | 'EMPRESA_TRANSPORTE'
  | 'PRODUCTOR' | 'EXPORTADORA' | 'PLANTA'

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

export interface TipoMovimientoListFilters {
  modulo?: ModuloSistema
  clase?: ClaseMovimiento
  activo?: boolean
  page?: number
  limit?: number
}
