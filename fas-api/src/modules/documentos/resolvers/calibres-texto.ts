// Calibres en el PDF (2026-11-05): RANGO = "Desde {menor} hasta {mayor}" según
// el orden del mantenedor de calibres; ESPECIFICOS = lista. Con un solo calibre
// se muestra tal cual en ambos modos.
export function textoCalibres(
  calibres: { descripcion: string; orden: number }[],
  modo: 'ESPECIFICOS' | 'RANGO',
  idioma: 'ES' | 'EN' = 'ES',
): string {
  const ordenados = [...calibres].sort((a, b) => a.orden - b.orden)
  if (modo === 'RANGO' && ordenados.length > 1) {
    const [desde, hasta] = [ordenados[0].descripcion, ordenados[ordenados.length - 1].descripcion]
    return idioma === 'EN' ? `From ${desde} to ${hasta}` : `Desde ${desde} hasta ${hasta}`
  }
  return ordenados.map((c) => c.descripcion).join(', ')
}
