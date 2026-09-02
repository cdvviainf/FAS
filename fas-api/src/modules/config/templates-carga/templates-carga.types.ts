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
// PACKING_LIST queda deliberadamente sin campos: el spec (compras.md §9.3)
// describe la reconciliación a alto nivel pero no define las columnas del
// Excel todavía — un tipo con [] simplemente no puede crearse (ver
// validarCoherenciaTemplate en el service) hasta que se le agreguen campos
// en una iteración futura.
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
  ],
  PACKING_LIST: [],
}

// Campos del tipo que NO son obligatorios de mapear al crear/editar un
// Template (2026-09-02, compras.md §4.8): Nota Calidad/Condición/Completo
// son opcionales tanto a nivel de columna (el Template puede no traerlas)
// como de valor (la celda puede venir vacía) — no romper templates ya
// existentes que no las contemplaban.
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
