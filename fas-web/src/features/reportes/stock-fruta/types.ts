export interface MantenedorRef {
  id: number
  codigo: string
  descripcion: string
}

export type OrigenStock = 'COMPRA' | 'CONSIGNACION' | 'PROCESO'
export type EstadoStock = 'CARGADA' | 'VALIDADA'

export const ESTADO_STOCK_LABELS: Record<EstadoStock, string> = {
  CARGADA: 'Cargada',
  VALIDADA: 'Validada',
}

// Una fila por PalletLinea — el filtrado, la agrupación y la antigüedad se
// resuelven acá en el cliente sobre el dataset completo (ver
// stock-fruta-client.tsx). El backend no aplica filtros (compras.md §11).
export interface StockDetalleRow {
  palletLineaId: number
  palletId: number
  numeroPallet: string
  especieId: number
  especie: MantenedorRef
  variedadId: number
  variedad: MantenedorRef
  categoriaId: number
  categoria: MantenedorRef
  calibreId: number
  calibre: MantenedorRef
  productorId: number
  productor: MantenedorRef
  origen: OrigenStock
  estado: EstadoStock
  fechaRecepcion: string
  cajas: number
  kg: number
}

export type AntiguedadBucket = 'fresh' | 'mid' | 'old'

export const ANTIGUEDAD_LABELS: Record<AntiguedadBucket, string> = {
  fresh: '0–7 días',
  mid: '8–15 días',
  old: '+15 días',
}

export function diasAntiguedad(fechaRecepcionIso: string, referencia: Date = new Date()): number {
  const fecha = new Date(fechaRecepcionIso)
  return Math.round((referencia.getTime() - fecha.getTime()) / 86_400_000)
}

export function bucketAntiguedad(dias: number): AntiguedadBucket {
  if (dias <= 7) return 'fresh'
  if (dias <= 15) return 'mid'
  return 'old'
}
