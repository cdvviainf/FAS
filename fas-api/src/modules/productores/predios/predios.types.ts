export interface PredioCreateInput {
  codigo: string
  descripcion: string
  codigoCsg?: string | null
  nombreCsg?: string | null
  codigoSdp?: string | null
  codigoGgn?: string | null
  direccion?: string | null
  comunaId?: number | null
  tipoProduccionId?: number | null
  zonaId?: number | null
  latitud?: number | null
  longitud?: number | null
}

export type PredioUpdateInput = Partial<Omit<PredioCreateInput, 'codigo'>>
