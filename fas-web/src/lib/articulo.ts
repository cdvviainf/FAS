// Descripción comercial del Artículo (2026-11-05): se despliega en todos los
// módulos comerciales; `descripcion` queda solo para Materiales. Fallback a
// `descripcion` si no hay descripción comercial cargada.
export function articuloDescripcionComercial(a: { descripcion: string; descripcionComercial?: string | null }): string {
  return a.descripcionComercial?.trim() || a.descripcion
}
