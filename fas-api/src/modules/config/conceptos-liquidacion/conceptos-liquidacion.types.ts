export type FormaAplicacionConcepto = 'POR_KILO' | 'POR_CAJA' | 'PORCENTAJE_VENTA' | 'MONTO_TOTAL'
export type NaturalezaConcepto = 'COBRO' | 'ABONO'

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
