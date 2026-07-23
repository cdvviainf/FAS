export type NaturalezaMovimientoCC = 'DEBE' | 'HABER'

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

export interface CuentaCorrienteFilters {
  fechaDesde?: string
  fechaHasta?: string
  temporadaId?: number
}
