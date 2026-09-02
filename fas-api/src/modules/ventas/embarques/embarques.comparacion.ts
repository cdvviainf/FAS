// Comparación pura Pallet↔detalle de NV (ventas.md R8: "la fruta asignada al
// contenedor debe estar ⊆ detalle de la NV") — solo catálogo (especie/
// variedad/categoría/artículo/calibre), sin tope de cantidad (decisión de
// negocio, Christian, 2026-09-02). Sin acceso a BD a propósito, mismo motivo
// que recepciones.comparacion.ts: se llama tanto en el listado de
// disponibles como en la reserva bajo lock, con datos leídos en momentos
// distintos.

export interface LineaPalletParaComparar {
  especieId: number
  variedadId: number
  categoriaId: number
  articuloId: number
  calibreId: number
}

export interface LineaNotaVentaParaComparar {
  especieId: number
  variedadId: number
  // null = la línea de la NV no exige una categoría puntual (categoriaId es
  // nullable en NotaVentaDetalle, a diferencia de OrdenCompraLinea).
  categoriaId: number | null
  articuloId: number
  calibres: Array<{ calibreId: number }>
}

// Un pallet "calza" con el detalle de la NV si TODAS sus líneas encuentran
// alguna línea de la NV compatible (especie+variedad+artículo iguales,
// categoría igual o sin exigencia, calibre dentro de la lista de esa línea).
export function palletCalzaConDetalleNV(lineasPallet: LineaPalletParaComparar[], detalleNV: LineaNotaVentaParaComparar[]): boolean {
  return lineasPallet.every((lp) =>
    detalleNV.some(
      (ln) =>
        ln.especieId === lp.especieId &&
        ln.variedadId === lp.variedadId &&
        ln.articuloId === lp.articuloId &&
        (ln.categoriaId === null || ln.categoriaId === lp.categoriaId) &&
        ln.calibres.some((c) => c.calibreId === lp.calibreId),
    ),
  )
}
