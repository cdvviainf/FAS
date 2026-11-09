// Tipo de documento de las Proformas (Materiales y Productores) — 2026-11-09.
// Reemplaza la marca "exento" por línea: afecto/exento lo define el documento,
// igual que en el Generador DTE. 33 = Factura Nacional (afecta, IVA 19%),
// 34 = Factura Exenta. La Factura generada desde la Proforma hereda el tipo.
export type TipoDteProforma = 33 | 34

export const TIPO_DTE_PROFORMA_LABELS: Record<TipoDteProforma, string> = {
  33: 'Factura Nacional',
  34: 'Factura Exenta',
}

const IVA_TASA = 0.19

/** Totales según el tipo de documento (mismo criterio que el backend: IVA en
 * pesos enteros sobre el neto). `base` = Σ montos de las líneas. */
export function totalesProforma(base: number, tipoDte: TipoDteProforma) {
  const b = Math.round(base * 100) / 100
  if (tipoDte === 34) return { neto: 0, iva: 0, exento: b, total: b }
  const iva = Math.round(b * IVA_TASA)
  return { neto: b, iva, exento: 0, total: Math.round((b + iva) * 100) / 100 }
}
