// Vencimiento ESTIMADO de una cuota de Proforma (2026-11-09): fecha de la
// Proforma + plazo de la Condición de Pago, solo para referencia FACTURA (la
// fecha real se fija al firmar la Factura). Zarpe/arribo/envío de documentos no
// tienen fecha conocida en la Proforma → null. Mismo criterio que la pantalla
// (fas-web src/lib/vencimiento-estimado.ts).
const DIA_MS = 24 * 60 * 60 * 1000

export function vencimientoEstimadoIso(fechaReferencia: string, plazoDias: number, fechaProforma: Date): string | null {
  if (fechaReferencia !== 'FACTURA') return null
  const base = Date.UTC(fechaProforma.getUTCFullYear(), fechaProforma.getUTCMonth(), fechaProforma.getUTCDate())
  return new Date(base + plazoDias * DIA_MS).toISOString().slice(0, 10)
}
