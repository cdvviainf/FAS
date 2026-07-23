export type FormaAplicacionConcepto = 'POR_KILO' | 'POR_CAJA' | 'PORCENTAJE_VENTA' | 'MONTO_TOTAL'
export type NaturalezaConcepto = 'COBRO' | 'ABONO'

export const FORMA_APLICACION_LABELS: Record<FormaAplicacionConcepto, string> = {
  POR_KILO: 'Por Kilo',
  POR_CAJA: 'Por Caja',
  PORCENTAJE_VENTA: '% de Venta',
  MONTO_TOTAL: 'Monto Total',
}

export const NATURALEZA_CONCEPTO_LABELS: Record<NaturalezaConcepto, string> = {
  COBRO: 'Cobro (-)',
  ABONO: 'Abono (+)',
}

export interface ValorEspecie {
  id: number
  especieId: number
  especie: { id: number; codigo: string; descripcion: string }
  valor: string
}

export interface ConceptoLiquidacion {
  id: number
  codigo: string
  descripcion: string
  formaAplicacion: FormaAplicacionConcepto
  naturaleza: NaturalezaConcepto
  valores: ValorEspecie[]
}

export interface ValorEspecieInput {
  especieId: number
  valor: number
}

export interface ConceptoLiquidacionCreateInput {
  codigo: string
  descripcion: string
  formaAplicacion: FormaAplicacionConcepto
  naturaleza: NaturalezaConcepto
  valores: ValorEspecieInput[]
}

export type ConceptoLiquidacionUpdateInput = Partial<Omit<ConceptoLiquidacionCreateInput, 'codigo'>>
