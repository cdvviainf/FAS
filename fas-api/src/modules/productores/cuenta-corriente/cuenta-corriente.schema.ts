import { z } from 'zod'

export const movimientoCCCreateSchema = z.object({
  tipoId: z.number().int().positive('El tipo/concepto es requerido'),
  naturaleza: z.enum(['DEBE', 'HABER']),
  fecha: z.string().date(),
  glosa: z.string().max(300).trim().optional().nullable(),
  monto: z.number().positive('El monto debe ser mayor a 0'),
  monedaId: z.number().int().positive().optional().nullable(),
  referencia: z.string().max(100).trim().optional().nullable(),
  temporadaId: z.number().int().positive().optional().nullable(),
})

export const productorParamsSchema = z.object({
  entidadId: z.coerce.number().int().positive(),
})

export const cuentaCorrienteQuerySchema = z.object({
  fechaDesde: z.string().date().optional(),
  fechaHasta: z.string().date().optional(),
  temporadaId: z.coerce.number().int().positive().optional(),
})

export type MovimientoCCCreateBody = z.infer<typeof movimientoCCCreateSchema>
