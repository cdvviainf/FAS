export interface Coordenadas {
  lat: number
  lng: number
}

// Reconoce coordenadas pegadas en texto plano ("lat, lng") o dentro de un
// link de Google Maps con las coordenadas visibles en la URL (patrones
// "@lat,lng,zoom" o "?q=lat,lng"/"&q=lat,lng"). No resuelve short-links
// (maps.app.goo.gl) — requeriría una llamada de red a un servicio externo.
export function parseCoordenadas(texto: string): Coordenadas | null {
  const t = texto.trim()

  const plano = t.match(/^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/)
  if (plano) return { lat: parseFloat(plano[1]), lng: parseFloat(plano[2]) }

  const arroba = t.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/)
  if (arroba) return { lat: parseFloat(arroba[1]), lng: parseFloat(arroba[2]) }

  const query = t.match(/[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/)
  if (query) return { lat: parseFloat(query[1]), lng: parseFloat(query[2]) }

  return null
}

export async function leerCoordenadasDelPortapapeles(): Promise<Coordenadas | null> {
  const texto = await navigator.clipboard.readText()
  return parseCoordenadas(texto)
}
