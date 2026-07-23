export type NaturalezaMovimientoCC = 'DEBE' | 'HABER'

export interface MovimientoCC {
  id: number
  entidadId: number
  tipoId: number
  tipo: { id: number; codigo: string; descripcion: string; naturaleza: 'DEBE' | 'HABER' | 'AMBOS' }
  naturaleza: NaturalezaMovimientoCC
  fecha: string
  glosa: string | null
  monto: string
  monedaId: number | null
  moneda: { id: number; codigo: string; descripcion: string } | null
  referencia: string | null
  temporadaId: number | null
  usuarioId: string
  creadoEn: string
}

export interface InformeCC {
  movimientos: MovimientoCC[]
  saldo: number
}

export interface MovimientoCCCreateInput {
  tipoId: number
  naturaleza: NaturalezaMovimientoCC
  fecha: string
  glosa?: string | null
  monto: number
  monedaId?: number | null
  referencia?: string | null
  temporadaId?: number | null
}
