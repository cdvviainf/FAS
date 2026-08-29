export type ClaseMovimientoKardex = 'ENTRADA' | 'SALIDA' | 'TRASLADO'

export const CLASE_MOVIMIENTO_LABELS: Record<ClaseMovimientoKardex, string> = {
  ENTRADA: 'Entrada',
  SALIDA: 'Salida',
  TRASLADO: 'Traslado',
}

interface MantenedorRef {
  id: number
  codigo: string
  descripcion: string
}

// Una fila por línea de Movimiento que afecta al artículo (y a la bodega, si
// se filtró una) — el backend reconstruye el saldo corrido reproduciendo el
// historial completo (ver kardex.service.ts en fas-api).
export interface KardexRow {
  movimientoId: number
  fecha: string
  tipoMovimiento: { id: number; codigo: string; descripcion: string }
  clase: ClaseMovimientoKardex
  bodegaOrigen: MantenedorRef | null
  bodegaDestino: MantenedorRef | null
  entidad: MantenedorRef | null
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
  bodega: MantenedorRef | null
  saldoInicial: KardexSaldo
  saldoFinal: KardexSaldo
  rows: KardexRow[]
}

export interface KardexFilters {
  articuloId: number
  bodegaId?: number
  fechaDesde?: string
  fechaHasta?: string
}
