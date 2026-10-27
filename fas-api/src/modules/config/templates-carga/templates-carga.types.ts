// Tipos de Template de Carga (compras.md §9.2: "patrón único reutilizado
// tanto para el reporte de stock de consignación como para el Packing
// List"). Whitelist en backend (no enum Prisma) — agregar un tipo nuevo no
// debe requerir migración, mismo criterio que MODELOS_CON_CODIGO en
// Prefijos de Código. Inmutable tras crear un TemplateCarga (ver
// templates-carga.schema.ts): cambiarlo invalidaría los campos ya mapeados.
export const TIPOS_TEMPLATE_CARGA = ['RECEPCION', 'PACKING_LIST'] as const

export type TipoTemplateCarga = (typeof TIPOS_TEMPLATE_CARGA)[number]

export const TIPO_TEMPLATE_CARGA_LABELS: Record<TipoTemplateCarga, string> = {
  RECEPCION: 'Recepción de Fruta',
  PACKING_LIST: 'Packing List',
}

// Campos objetivo que puede mapear un Template de Carga hacia el Excel, por
// tipo (compras.md §9.2/§7). Whitelist en backend (no enum Prisma) por el
// mismo motivo que TIPOS_TEMPLATE_CARGA arriba.
//
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
    // Fecha de embalaje / Etiqueta / Packing (2026-09-21, compras.md §4.6) —
    // por línea (no por pallet, a diferencia de las 3 de arriba), obligatorios.
    'FECHA_EMBALAJE',
    'ETIQUETA',
    'PACKING',
  ],
  // Formato de carga del Packing List (2026-09-21) — mismos campos que
  // Recepción salvo Nota Calidad/Condición/Completo y Packing (no aplican
  // acá). TERMOGRAFO (2026-10-12) es opcional (ver CAMPOS_OPCIONALES_POR_TIPO);
  // el resto son obligatorios.
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
    // Temperatura (°C) por pallet (2026-10-25): opcional (ver
    // CAMPOS_OPCIONALES_POR_TIPO). Se persiste por pallet y alimenta la emisión
    // del Packing List. El TERMOGRAFO también pasa a asociarse por pallet.
    'TEMPERATURA',
    // Guía de despacho por pallet (2026-10-23): N° de guía con que el productor/
    // planta despachó la fruta, y su emisor. Ambos opcionales (ver
    // CAMPOS_OPCIONALES_POR_TIPO); el emisor se acota a los productores/plantas
    // asociados al embarque al reconciliar.
    'NUMERO_GUIA',
    'EMISOR_GUIA',
  ],
}

// Campos del tipo que NO son obligatorios de mapear al crear/editar un
// Template (2026-09-02, compras.md §4.8): Nota Calidad/Condición/Completo
// son opcionales tanto a nivel de columna (el Template puede no traerlas)
// como de valor (la celda puede venir vacía) — no romper templates ya
// existentes que no las contemplaban.
export const CAMPOS_OPCIONALES_POR_TIPO: Record<TipoTemplateCarga, readonly string[]> = {
  RECEPCION: ['NOTA_CALIDAD', 'NOTA_CONDICION', 'COMPLETO'],
  // TERMOGRAFO/TEMPERATURA (2026-10-12/25): opcionales tanto de mapear (no
  // rompen templates PACKING_LIST ya creados) como de valor (la celda puede
  // venir vacía). NUMERO_GUIA y EMISOR_GUIA pasaron a OBLIGATORIOS (2026-10-27):
  // deben mapearse en el template y traer valor en la carga (los templates
  // existentes sin esas columnas deben actualizarse).
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
