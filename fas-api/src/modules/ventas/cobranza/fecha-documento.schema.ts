import { z } from 'zod'

// Fecha del documento: fecha CALENDARIO "YYYY-MM-DD" (decisión de negocio
// 2026-09-30 — la fecha de un documento tributario/comercial no lleva hora ni
// zona horaria). Se valida el formato y que el día sea calendáricamente válido
// (rechaza p.ej. 2026-02-31) antes de que el service haga `new Date()`.
function esFechaCalendarioValida(v: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v)
  if (!m) return false
  const [, y, mo, day] = m
  // Construye en UTC y verifica que ningún componente haya "rodado".
  const d = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(day)))
  return d.getUTCFullYear() === Number(y) && d.getUTCMonth() + 1 === Number(mo) && d.getUTCDate() === Number(day)
}

export const fechaDocumentoSchema = z
  .string()
  .trim()
  .refine(esFechaCalendarioValida, 'Fecha inválida — usa el formato AAAA-MM-DD')
  .optional()
  .nullable()

// Variante OBLIGATORIA — para la emisión (no se puede emitir sin fecha).
export const fechaDocumentoRequeridaSchema = z
  .string()
  .trim()
  .min(1, 'La fecha del documento es obligatoria')
  .refine(esFechaCalendarioValida, 'Fecha inválida — usa el formato AAAA-MM-DD')
