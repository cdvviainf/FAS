// Descripción comercial del Artículo (2026-11-05): la que se despliega en todos
// los módulos comerciales (Cierre, OC fruta, Instructivos, Embarque, Proforma,
// Factura, Calidad, Productores...). `descripcion` queda solo para el área de
// Materiales. Si el artículo no tiene descripción comercial cargada, se usa
// `descripcion` como respaldo (no rompe datos existentes).
export function descripcionComercialArticulo(a: { descripcion: string; descripcionComercial?: string | null }): string {
  return a.descripcionComercial?.trim() || a.descripcion
}

// Select reutilizable de Prisma para resolver la descripción comercial.
export const articuloDescripcionSelect = { descripcion: true, descripcionComercial: true } as const
