import { z } from 'zod'

export const kardexQuerySchema = z.object({
  articuloId: z.coerce.number().int().positive('El artículo es requerido'),
  bodegaId: z.coerce.number().int().positive().optional(),
  fechaDesde: z.string().date().optional(),
  fechaHasta: z.string().date().optional(),
})

export type KardexQuery = z.infer<typeof kardexQuerySchema>
