export type UnidadVolumen = 'KG' | 'CAJAS'

export interface Contrato {
  id: number
  entidadId: number
  temporadaId: number | null
  temporada: { id: number; codigo: string; descripcion: string } | null
  pdfNombre: string | null
  pdfMime: string | null
  pdfTamano: number | null
  fechaInicio: string | null
  fechaTermino: string | null
  valoresFacturacion: string | null
  condicionesPago: string | null
  condicionesFacturacion: string | null
  volumenComprometido: string | null
  unidadVolumen: UnidadVolumen | null
  minimoGarantizado: string | null
  creadoEn: string
}

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
