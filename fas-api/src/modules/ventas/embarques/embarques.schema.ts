import { z } from 'zod'

// numeroInstructivo ya no se ingresa manualmente (2026-08-13, ventas.md
// R10 — supersesión): se calcula en el service a partir del folio de la NV
// y el prefijo configurado para su Tipo de Embarque.
export const embarqueCreateSchema = z.object({
  notaVentaId: z.number().int().positive('El Cierre Comercial es requerido'),
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
