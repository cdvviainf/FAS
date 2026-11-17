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
  // Desde HTTP no viaja: la del selector superior (2026-11-16). Solo llamadores
  // internos (tests/jobs) la pasan.
  temporadaId?: number | null
  especieId: number
  fechaInicio: string
  fechaTermino: string
  condicionPagoId?: number | null
  responsableId?: string | null
  lineas: ContratoLineaInput[]
}

export type ContratoUpdateInput = Partial<ContratoCreateInput>
