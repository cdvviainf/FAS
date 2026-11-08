import { z } from 'zod'

// Monitor DTE (2026-11-07): documentos electrónicos firmados (DocumentoDte
// GENERADO) con su estado SII.
// Fecha calendario real YYYY-MM-DD (rechaza 2026-02-30, 2026-99-99) — FAS-MDTE-R1-001.
const fechaIso = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha YYYY-MM-DD')
  .refine((v) => {
    const [a, m, d] = v.split('-').map(Number)
    const f = new Date(Date.UTC(a, m - 1, d))
    return f.getUTCFullYear() === a && f.getUTCMonth() === m - 1 && f.getUTCDate() === d
  }, 'Fecha inválida')

export const monitorDteListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(200).default(20),
    tipoDte: z.coerce.number().int().positive().optional(),
    estadoSii: z.enum(['PENDIENTE', 'ACEPTADO', 'RECHAZADO']).optional(),
    fechaDesde: fechaIso.optional(),
    fechaHasta: fechaIso.optional(),
    folio: z.coerce.number().int().positive().optional(),
    // RUT o razón social del receptor (contiene, sin distinguir mayúsculas).
    receptor: z.string().trim().min(1).max(100).optional(),
  })
  // YYYY-MM-DD compara bien como texto.
  .refine((q) => !q.fechaDesde || !q.fechaHasta || q.fechaDesde <= q.fechaHasta, {
    message: 'La fecha "desde" no puede ser posterior a la fecha "hasta"',
    path: ['fechaHasta'],
  })

export const monitorDteParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
})

export type MonitorDteListQuery = z.infer<typeof monitorDteListQuerySchema>
