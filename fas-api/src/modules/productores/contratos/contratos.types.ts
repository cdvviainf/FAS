export type UnidadVolumen = 'KG' | 'CAJAS'

export interface ContratoCreateInput {
  temporadaId?: number | null
  fechaInicio?: string | null
  fechaTermino?: string | null
  valoresFacturacion?: string | null
  condicionesPago?: string | null
  condicionesFacturacion?: string | null
  volumenComprometido?: number | null
  unidadVolumen?: UnidadVolumen | null
  minimoGarantizado?: number | null
}

export type ContratoUpdateInput = Partial<ContratoCreateInput>
