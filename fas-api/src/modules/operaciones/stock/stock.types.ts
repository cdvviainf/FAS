export type OrigenStock = 'COMPRA' | 'CONSIGNACION' | 'PROCESO'
export type EstadoStock = 'CARGADA' | 'VALIDADA'

interface Mantenedor {
  id: number
  codigo: string
  descripcion: string
}

// Una fila por PalletLinea — el reporte en pantalla (fas-web) resuelve
// filtros, agrupación por especie/variedad/calibre/categoría y antigüedad
// (hoy - fechaRecepcion) en el cliente, sobre el dataset completo devuelto
// acá; no hay filtros server-side (2026-08-24, ver compras.md §11).
export interface StockDetalleRow {
  palletLineaId: number
  palletId: number
  numeroPallet: string
  especieId: number
  especie: Mantenedor
  variedadId: number
  variedad: Mantenedor
  categoriaId: number
  categoria: Mantenedor
  calibreId: number
  calibre: Mantenedor
  productorId: number
  productor: Mantenedor
  origen: OrigenStock
  // Estado de la Recepción que generó el Pallet (CARGADA|VALIDADA) — RECHAZADA
  // nunca llega acá porque una Recepción rechazada no genera Pallets.
  estado: EstadoStock
  fechaRecepcion: Date
  cajas: number
  // cajas × Articulo.kgNetoEnvase de la línea (peso neto de fruta, sin el
  // embalaje) — 0 si el artículo no tiene kgNetoEnvase configurado.
  kg: number
}
