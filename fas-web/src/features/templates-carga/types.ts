export const CAMPOS_TEMPLATE_CARGA = [
  'NUMERO_PALLET',
  'ESPECIE',
  'VARIEDAD',
  'CATEGORIA',
  'ARTICULO',
  'CALIBRE',
  'CAJAS',
  'PRODUCTOR',
] as const

export type CampoTemplateCarga = (typeof CAMPOS_TEMPLATE_CARGA)[number]

export const CAMPO_TEMPLATE_CARGA_LABELS: Record<CampoTemplateCarga, string> = {
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
  campo: CampoTemplateCarga
  columna: string
}

export interface TemplateCarga {
  id: number
  codigo: string
  descripcion: string
  tieneCabecera: boolean
  filaCabecera: number | null
  filaPrimerRegistro: number
  bloqueado: boolean
  campos: TemplateCargaCampo[]
}

export interface TemplateCargaCampoInput {
  campo: CampoTemplateCarga
  columna: string
}

export interface TemplateCargaCreateInput {
  codigo: string
  descripcion: string
  tieneCabecera: boolean
  filaCabecera?: number | null
  filaPrimerRegistro: number
  campos: TemplateCargaCampoInput[]
}

export type TemplateCargaUpdateInput = Partial<Omit<TemplateCargaCreateInput, 'codigo'>> & {
  bloqueado?: boolean
}
