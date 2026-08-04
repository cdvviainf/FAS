// Tipos de Template de Carga (compras.md §9.2). Espejo exacto del whitelist
// del backend (templates-carga.types.ts) — agregar un tipo nuevo se hace acá
// y allá, nada más cambia.
export const TIPOS_TEMPLATE_CARGA = ['RECEPCION', 'PACKING_LIST'] as const

export type TipoTemplateCarga = (typeof TIPOS_TEMPLATE_CARGA)[number]

export const TIPO_TEMPLATE_CARGA_LABELS: Record<TipoTemplateCarga, string> = {
  RECEPCION: 'Recepción de Fruta',
  PACKING_LIST: 'Packing List',
}

// PACKING_LIST queda [] a propósito: el spec todavía no define sus columnas
// (ver comentario en el backend) — un tipo sin campos no se puede crear.
export const CAMPOS_POR_TIPO: Record<TipoTemplateCarga, readonly string[]> = {
  RECEPCION: ['NUMERO_PALLET', 'ESPECIE', 'VARIEDAD', 'CATEGORIA', 'ARTICULO', 'CALIBRE', 'CAJAS', 'PRODUCTOR'],
  PACKING_LIST: [],
}

export const CAMPO_TEMPLATE_CARGA_LABELS: Record<string, string> = {
  NUMERO_PALLET: 'N° Pallet',
  ESPECIE: 'Especie',
  VARIEDAD: 'Variedad',
  CATEGORIA: 'Categoría',
  ARTICULO: 'Artículo / Embalaje',
  CALIBRE: 'Calibre',
  CAJAS: 'Cajas',
  PRODUCTOR: 'Productor',
}

export interface TemplateCargaCampo {
  id: number
  campo: string
  columna: string
}

export interface TemplateCarga {
  id: number
  codigo: string
  tipo: TipoTemplateCarga
  descripcion: string
  tieneCabecera: boolean
  filaCabecera: number | null
  filaPrimerRegistro: number
  bloqueado: boolean
  campos: TemplateCargaCampo[]
}

export interface TemplateCargaCampoInput {
  campo: string
  columna: string
}

export interface TemplateCargaCreateInput {
  codigo: string
  tipo: TipoTemplateCarga
  descripcion: string
  tieneCabecera: boolean
  filaCabecera?: number | null
  filaPrimerRegistro: number
  campos: TemplateCargaCampoInput[]
}

export type TemplateCargaUpdateInput = Partial<Omit<TemplateCargaCreateInput, 'codigo' | 'tipo'>> & {
  bloqueado?: boolean
}
