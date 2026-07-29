// Campos objetivo que puede mapear un Template de Carga hacia el Excel de
// Recepción (compras.md §9.2/§7). Whitelist en backend (no enum Prisma) para
// poder ampliarla sin migración — mismo patrón que MODELOS_CON_CODIGO en
// Prefijos de Código.
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

export interface TemplateCargaCampoInput {
  campo: string
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
