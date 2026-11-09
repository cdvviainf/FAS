import { z } from 'zod'

export const proformaMaterialCreateSchema = z.object({
  movimientoId: z.number().int().positive('El movimiento es requerido'),
  formaPagoId: z.number().int().positive().optional().nullable(),
  condicionPagoId: z.number().int().positive().optional().nullable(),
  monedaId: z.number().int().positive('La moneda es requerida'),
  // Tipo de cambio (CLP por 1 unidad) — obligatorio si la moneda no es CLP (2026-11-09).
  tipoCambio: z.number().positive('El tipo de cambio debe ser mayor a 0').max(9_999_999_999.9999, 'El tipo de cambio es demasiado grande').optional().nullable(),
  observaciones: z.string().max(2000).trim().optional().nullable(),
})

export const proformaMaterialUpdateSchema = proformaMaterialCreateSchema.omit({ movimientoId: true }).partial()

export const proformaMaterialLineaUpdateSchema = z.object({
  precioUnitario: z.number().nonnegative('El precio no puede ser negativo'),
})

export const proformaMaterialParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
})

export const proformaMaterialLineaParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
  lineaId: z.coerce.number().int().positive(),
})

export const proformaMaterialListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  entidadId: z.coerce.number().int().positive().optional(),
  estado: z.enum(['BORRADOR', 'ENVIADA_VALIDACION', 'FACTURADA', 'ANULADA']).optional(),
})

export type ProformaMaterialCreateBody = z.infer<typeof proformaMaterialCreateSchema>
export type ProformaMaterialUpdateBody = z.infer<typeof proformaMaterialUpdateSchema>
export type ProformaMaterialLineaUpdateBody = z.infer<typeof proformaMaterialLineaUpdateSchema>

export const proformaMaterialTipoCambioQuerySchema = z.object({
  moneda: z.string().trim().min(1, 'La moneda es requerida'),
  // Fecha calendario real (rechaza 2026-02-30 / 2026-99-99 — TCQA-R1-002).
  fecha: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (YYYY-MM-DD)')
    .refine((v) => {
      const [a, m, d] = v.split('-').map(Number)
      const f = new Date(Date.UTC(a, m - 1, d))
      return f.getUTCFullYear() === a && f.getUTCMonth() === m - 1 && f.getUTCDate() === d
    }, 'Fecha inválida')
    .optional(),
})
