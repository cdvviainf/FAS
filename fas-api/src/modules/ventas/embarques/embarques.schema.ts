import { z } from 'zod'

export const embarqueCreateSchema = z.object({
  notaVentaId: z.number().int().positive('El Cierre Comercial es requerido'),
  numeroInstructivo: z.string().min(1, 'El número de instructivo (Folio) es requerido').max(50).trim(),
})

export const embarqueParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
})

export const embarqueListQuerySchema = z.object({
  notaVentaId: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(500).default(20),
})

export type EmbarqueCreateBody = z.infer<typeof embarqueCreateSchema>
