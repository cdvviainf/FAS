import { z } from 'zod'

export const proformaMaterialCreateSchema = z.object({
  movimientoId: z.number().int().positive('El movimiento es requerido'),
  formaPagoId: z.number().int().positive().optional().nullable(),
  condicionPagoId: z.number().int().positive().optional().nullable(),
  monedaId: z.number().int().positive('La moneda es requerida'),
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
