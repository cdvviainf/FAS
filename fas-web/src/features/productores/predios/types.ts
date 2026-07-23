export interface Predio {
  id: number
  entidadId: number
  codigo: string
  descripcion: string
  codigoCsg: string | null
  nombreCsg: string | null
  codigoSdp: string | null
  codigoGgn: string | null
  direccion: string | null
  comunaId: number | null
  comuna: { id: number; descripcion: string } | null
  tipoProduccionId: number | null
  tipoProduccion: { id: number; descripcion: string } | null
  zonaId: number | null
  zona: { id: number; descripcion: string } | null
  latitud: string | null
  longitud: string | null
}

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
