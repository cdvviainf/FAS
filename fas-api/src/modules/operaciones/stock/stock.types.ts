export type OrigenStock = 'COMPRA' | 'CONSIGNACION' | 'PROCESO'
export type EstadoStock = 'CARGADA' | 'VALIDADA'

interface Mantenedor {
  id: number
  codigo: string
  descripcion: string
}

// orden: secuencia del calibre dentro de su especie (mantenedores-generales.md)
// — usado para graficar la distribución de calibres en el orden real, no alfabético.
interface CalibreConOrden extends Mantenedor {
  orden: number
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
  calibre: CalibreConOrden
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
  // Nota de Calidad/Condición y Completo/Incompleto (compras.md §4.8,
  // 2026-09-02) — a nivel de Pallet, no de línea (se repiten idénticas en
  // todas las líneas de un mismo pallet).
  notaCalidadId: number | null
  notaCalidad: Mantenedor | null
  notaCondicionId: number | null
  notaCondicion: Mantenedor | null
  completo: boolean
}

export interface PalletUpdateInput {
  notaCalidadId?: number | null
  notaCondicionId?: number | null
  completo?: boolean
}
