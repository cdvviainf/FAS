export interface KardexFilters {
  articuloId: number
  bodegaId?: number
  fechaDesde?: string
  fechaHasta?: string
}

interface Mantenedor {
  id: number
  codigo: string
  descripcion: string
}

export type ClaseMovimientoKardex = 'ENTRADA' | 'SALIDA' | 'TRASLADO'

export interface KardexRow {
  movimientoId: number
  fecha: Date
  tipoMovimiento: { id: number; codigo: string; descripcion: string }
  clase: ClaseMovimientoKardex
  bodegaOrigen: Mantenedor | null
  bodegaDestino: Mantenedor | null
  entidad: Mantenedor | null
  guiaReferencia: string | null
  cantidadEntrada: number
  cantidadSalida: number
  costoUnitario: number | null
  saldoCantidad: number
  saldoCostoPromedio: number
  saldoValorizado: number
}

export interface KardexSaldo {
  cantidad: number
  costoPromedio: number
  valorizado: number
}

export interface KardexResult {
  articulo: { id: number; codigo: string; descripcion: string }
  bodega: Mantenedor | null
  saldoInicial: KardexSaldo
  saldoFinal: KardexSaldo
  rows: KardexRow[]
}
