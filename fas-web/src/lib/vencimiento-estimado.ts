// Vencimiento ESTIMADO de una cuota de Proforma (2026-11-09): según la Condición
// de Pago, tomando como fecha de factura la fecha de la Proforma (o hoy si aún no
// se guarda). La fecha real se fija al firmar la Factura (fecha del documento +
// plazo). Solo referencia FACTURA: zarpe/arribo/envío de documentos no tienen
// fecha conocida en la Proforma → null.
export function vencimientoEstimado(fechaReferencia: string, plazoDias: number, fechaBase: string | null | undefined): string | null {
  if (fechaReferencia !== 'FACTURA') return null
  const base = fechaBase ? new Date(`${fechaBase.slice(0, 10)}T00:00:00`) : new Date()
  base.setHours(0, 0, 0, 0)
  base.setDate(base.getDate() + plazoDias)
  return base.toLocaleDateString('es-CL')
}
