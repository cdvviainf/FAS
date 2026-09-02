import { z } from 'zod'

export const palletUpdateSchema = z.object({
  notaCalidadId: z.number().int().positive().nullable().optional(),
  notaCondicionId: z.number().int().positive().nullable().optional(),
  completo: z.boolean().optional(),
})

export const palletParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
})

export type PalletUpdateBody = z.infer<typeof palletUpdateSchema>
