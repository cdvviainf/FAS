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

// Catálogo SII "IndTraslado" (motivo de traslado) — exigido por LibreDTE al
// emitir una Guía de Despacho electrónica (DTE 52).
export const IND_TRASLADO_SII_LABELS: Record<number, string> = {
  1: '1 — Operación constituye venta',
  2: '2 — Ventas por efectuar',
  3: '3 — Consignaciones',
  4: '4 — Entrega gratuita',
  5: '5 — Traslado interno',
  6: '6 — Otro traslado no venta',
  7: '7 — Guía de devolución',
  8: '8 — Traslado para exportación',
  9: '9 — Venta para exportación',
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
  // Motivo de traslado SII — requerido cuando emiteDTE=true (ver IND_TRASLADO_SII_LABELS).
  indTrasladoSii: number | null
  // Solo aplicable si clase = SALIDA (materiales.md R25) — marca este tipo
  // como origen elegible para generar una Proforma de Venta de Materiales.
  generaProforma: boolean
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
  indTrasladoSii?: number | null
  generaProforma?: boolean
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
