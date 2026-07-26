export interface ContratoLineaInput {
  articuloId: number
  variedadId: number
  calibreDesdeId: number
  calibreHastaId: number
  categoriaId: number
  unidadMedidaId: number
  cantidadComprometida: number
  minimoGarantizado: number
}

export interface ContratoCreateInput {
  temporadaId: number
  especieId: number
  fechaInicio: string
  fechaTermino: string
  condicionPagoId?: number | null
  lineas: ContratoLineaInput[]
}

export type ContratoUpdateInput = Partial<ContratoCreateInput>
