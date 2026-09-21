// Tipos de Template de Carga (compras.md §9.2). Espejo exacto del whitelist
// del backend (templates-carga.types.ts) — agregar un tipo nuevo se hace acá
// y allá, nada más cambia.
export const TIPOS_TEMPLATE_CARGA = ['RECEPCION', 'PACKING_LIST'] as const

export type TipoTemplateCarga = (typeof TIPOS_TEMPLATE_CARGA)[number]

export const TIPO_TEMPLATE_CARGA_LABELS: Record<TipoTemplateCarga, string> = {
  RECEPCION: 'Recepción de Fruta',
  PACKING_LIST: 'Packing List',
}

export const CAMPOS_POR_TIPO: Record<TipoTemplateCarga, readonly string[]> = {
  RECEPCION: [
    'NUMERO_PALLET',
    'ESPECIE',
    'VARIEDAD',
    'CATEGORIA',
    'ARTICULO',
    'CALIBRE',
    'CAJAS',
    'PRODUCTOR',
    'NOTA_CALIDAD',
    'NOTA_CONDICION',
    'COMPLETO',
    'FECHA_EMBALAJE',
    'ETIQUETA',
    'PACKING',
  ],
  // Formato de carga del Packing List (2026-09-21) — mismos campos que
  // Recepción salvo Nota Calidad/Condición/Completo y Packing; todos
  // obligatorios (sin entradas en CAMPOS_OPCIONALES_POR_TIPO).
  PACKING_LIST: [
    'NUMERO_PALLET',
    'ESPECIE',
    'VARIEDAD',
    'CATEGORIA',
    'CALIBRE',
    'ARTICULO',
    'CAJAS',
    'PRODUCTOR',
    'ETIQUETA',
    'FECHA_EMBALAJE',
  ],
}

// Campos del tipo que NO son obligatorios de mapear (2026-09-02, compras.md
// §4.8) — espejo de CAMPOS_OPCIONALES_POR_TIPO en el backend.
export const CAMPOS_OPCIONALES_POR_TIPO: Record<TipoTemplateCarga, readonly string[]> = {
  RECEPCION: ['NOTA_CALIDAD', 'NOTA_CONDICION', 'COMPLETO'],
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
  NOTA_CALIDAD: 'Nota de Calidad',
  NOTA_CONDICION: 'Nota de Condición',
  COMPLETO: 'Completo/Incompleto',
  FECHA_EMBALAJE: 'Fecha de Embalaje',
  ETIQUETA: 'Etiqueta',
  PACKING: 'Packing',
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
