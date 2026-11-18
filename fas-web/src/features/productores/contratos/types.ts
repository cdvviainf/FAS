interface RefSimple {
  id: number
  codigo: string
  descripcion: string
}

export interface ContratoLinea {
  id: number
  articuloId: number
  articulo: RefSimple & { etiqueta?: RefSimple | null; kgNetoEnvase?: string | null; kgBrutoEnvase?: string | null }
  variedadId: number
  variedad: RefSimple
  calibreDesdeId: number
  calibreDesde: RefSimple
  calibreHastaId: number
  calibreHasta: RefSimple
  categoriaId: number
  categoria: RefSimple
  unidadMedidaId: number
  unidadMedida: RefSimple
  cantidadComprometida: string
  minimoGarantizado: string
  // Condición de Pago por línea (2026-11-18). Null solo en líneas antiguas
  // cuyo contrato no tenía condición: se exige al editar.
  condicionPagoId: number | null
  condicionPago: RefSimple | null
}

export interface ContratoAdjunto {
  id: number
  nombre: string
  mime: string
  tamano: number
  subidoEn: string
  subidoPor: string
}

export interface Contrato {
  id: number
  entidadId: number
  temporadaId: number
  temporada: RefSimple
  especieId: number
  especie: RefSimple
  fechaInicio: string
  fechaTermino: string
  responsableId: string | null
  responsable: { id: string; nombre: string; email: string } | null
  lineas: ContratoLinea[]
  adjuntos: ContratoAdjunto[]
  creadoEn: string
}

export interface ContratoLineaInput {
  articuloId: number
  variedadId: number
  calibreDesdeId: number
  calibreHastaId: number
  categoriaId: number
  unidadMedidaId: number
  cantidadComprometida: number
  minimoGarantizado: number
  condicionPagoId: number
}

export interface ContratoCreateInput {
  especieId: number
  fechaInicio: string
  fechaTermino: string
  responsableId?: string | null
  lineas: ContratoLineaInput[]
}

export type ContratoUpdateInput = Partial<ContratoCreateInput>
