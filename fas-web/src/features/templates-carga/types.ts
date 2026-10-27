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
  // Recepción salvo Nota Calidad/Condición/Completo y Packing. TERMOGRAFO
  // (2026-10-12) es opcional (ver CAMPOS_OPCIONALES_POR_TIPO).
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
    'TERMOGRAFO',
    // Temperatura (°C) por pallet (2026-10-25): opcional. Se persiste por pallet
    // y alimenta la emisión del Packing List.
    'TEMPERATURA',
    // Guía de despacho por pallet (2026-10-23): N° de guía + emisor (opcionales;
    // el emisor se acota a productores/plantas del embarque al reconciliar).
    'NUMERO_GUIA',
    'EMISOR_GUIA',
  ],
}

// Campos del tipo que NO son obligatorios de mapear (2026-09-02, compras.md
// §4.8) — espejo de CAMPOS_OPCIONALES_POR_TIPO en el backend.
export const CAMPOS_OPCIONALES_POR_TIPO: Record<TipoTemplateCarga, readonly string[]> = {
  RECEPCION: ['NOTA_CALIDAD', 'NOTA_CONDICION', 'COMPLETO'],
  // NUMERO_GUIA y EMISOR_GUIA pasaron a OBLIGATORIOS (2026-10-27) — espejo del
  // backend (templates-carga.types.ts). Solo TERMOGRAFO/TEMPERATURA opcionales.
  PACKING_LIST: ['TERMOGRAFO', 'TEMPERATURA'],
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
  COMPLETO: 'Completo',
  FECHA_EMBALAJE: 'Fecha de Embalaje',
  ETIQUETA: 'Etiqueta',
  PACKING: 'Packing',
  TERMOGRAFO: 'Termógrafo',
  TEMPERATURA: 'Temperatura (°C)',
  NUMERO_GUIA: 'N° Guía de Despacho',
  EMISOR_GUIA: 'Emisor de la Guía',
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
