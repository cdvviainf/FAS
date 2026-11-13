// Compartido por la Factura Nacional (DTE 33/34) y la Proforma de Exportación
// (2026-11-13).
// Condición de pago de la Factura Nacional (2026-11-11, decisión del usuario):
// CONTADO si la fecha de vencimiento (última cuota) es la misma que la de
// emisión, o si no hay cuotas; CRÉDITO en cualquier otro caso (incluida una
// cuota sin fecha conocida, p. ej. desde zarpe). → IdDoc.FmaPago 1/2.
export function condicionPagoSii(
  cuotas: Array<{ fechaVencimiento: Date | null }>,
  fechaEmision: Date,
): { fmaPago: 1 | 2; etiqueta: 'Contado' | 'Crédito'; fechaVencimiento: Date | null } {
  if (cuotas.length === 0) return { fmaPago: 1, etiqueta: 'Contado', fechaVencimiento: fechaEmision }
  if (cuotas.some((c) => c.fechaVencimiento == null)) return { fmaPago: 2, etiqueta: 'Crédito', fechaVencimiento: null }
  const vence = cuotas.reduce((max, c) => (c.fechaVencimiento!.getTime() > max.getTime() ? c.fechaVencimiento! : max), cuotas[0].fechaVencimiento!)
  const mismoDia = vence.toISOString().slice(0, 10) === fechaEmision.toISOString().slice(0, 10)
  return mismoDia
    ? { fmaPago: 1, etiqueta: 'Contado', fechaVencimiento: vence }
    : { fmaPago: 2, etiqueta: 'Crédito', fechaVencimiento: vence }
}
