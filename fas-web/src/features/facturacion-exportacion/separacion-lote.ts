import type { ProformaLineaSugerida, SeparacionLinea } from './types'

// ─── "Separar cantidades" (2026-11-10) ───────────────────────────────────────
// Cada línea de fruta puede llevar una sublínea con texto libre (p. ej. "CAJAS
// PLASTICAS") y un valor unitario por la MISMA cantidad de cajas. Al separar, el
// precio de la fruta baja en ese valor: el precio total por caja (fruta +
// separado) se conserva, así que el total del documento no cambia.

const round2 = (n: number) => Math.round(n * 100) / 100
const round4 = (n: number) => Math.round(n * 10_000) / 10_000

// Monto de la línea = fruta y separado redondeados por separado (dos filas en
// el PDF y dos ítems en el DTE 110), igual que el backend.
export function montoLinea(cajas: number, precioUnitario: number, separacion: SeparacionLinea | null | undefined): number {
  const fruta = Math.round(precioUnitario * cajas * 100)
  const separado = separacion ? Math.round(separacion.precioUnitario * cajas * 100) : 0
  return (fruta + separado) / 100
}

// Precio total por caja (fruta + separado) de una línea.
function precioTotalCaja(l: ProformaLineaSugerida): number {
  return l.precioUnitario + (l.separacion?.precioUnitario ?? 0)
}

// Aplica (o quita, con `null`) una separación a UNA línea conservando su precio
// total por caja.
export function aplicarSeparacionLinea(l: ProformaLineaSugerida, sep: SeparacionLinea | null): ProformaLineaSugerida {
  const total = precioTotalCaja(l)
  const precioUnitario = sep ? round4(total - sep.precioUnitario) : round4(total)
  const separacion = sep ? { descripcion: sep.descripcion, precioUnitario: sep.precioUnitario } : null
  return { ...l, precioUnitario, separacion, montoLinea: montoLinea(l.cantidadCajas, precioUnitario, separacion) }
}

// Aplica la separación general a todas las líneas.
export function aplicarSeparacionGeneral(lineas: ProformaLineaSugerida[], sep: SeparacionLinea | null): ProformaLineaSugerida[] {
  return lineas.map((l) => aplicarSeparacionLinea(l, sep))
}

// Separación general válida (texto y valor > 0) o null.
export function separacionGeneral(activa: boolean, texto: string, valor: string): SeparacionLinea | null {
  const v = Number(valor)
  if (!activa || !texto.trim() || !(v > 0)) return null
  return { descripcion: texto.trim(), precioUnitario: round4(v) }
}

// Hay alguna línea cuyo precio de fruta quedó negativo por la separación.
export function hayPrecioNegativo(lineas: ProformaLineaSugerida[]): boolean {
  return lineas.some((l) => l.precioUnitario < 0)
}

export { round2 }

// ─── "Incluir LOTE" (2026-11-10) ─────────────────────────────────────────────
// Agrega "LOTE: {N° de Instructivo}" a las Observaciones (máx. 100 = límite SII
// de TermPagoGlosa). Si no cabe, se recorta el texto del usuario para conservar
// el LOTE.

export const MAX_OBSERVACIONES = 100

export function textoLote(numeroInstructivo: string): string {
  return `LOTE: ${numeroInstructivo.trim()}`
}

// Segmentos de las Observaciones separados por " / ". El LOTE de la casilla es
// un segmento completo "LOTE: X"; un "LOTE: X" escrito dentro de otra frase no
// cuenta ni se toca (FAS-NSL-R1-001).
const SEPARADOR = ' / '

function segmentos(observaciones: string): string[] {
  return observaciones.split(SEPARADOR)
}

export function tieneLote(observaciones: string, numeroInstructivo: string | null): boolean {
  if (!numeroInstructivo?.trim()) return false
  const lote = textoLote(numeroInstructivo)
  return segmentos(observaciones).some((p) => p.trim() === lote)
}

export function quitarLote(observaciones: string, numeroInstructivo: string): string {
  const lote = textoLote(numeroInstructivo)
  return segmentos(observaciones)
    .filter((p) => p.trim() !== lote)
    .join(SEPARADOR)
    .trim()
}

export function agregarLote(observaciones: string, numeroInstructivo: string): string {
  const lote = textoLote(numeroInstructivo)
  const base = quitarLote(observaciones, numeroInstructivo)
  if (!base) return lote.slice(0, MAX_OBSERVACIONES)
  const espacio = MAX_OBSERVACIONES - lote.length - SEPARADOR.length
  if (espacio <= 0) return lote.slice(0, MAX_OBSERVACIONES)
  return `${base.slice(0, espacio).trim()}${SEPARADOR}${lote}`
}
