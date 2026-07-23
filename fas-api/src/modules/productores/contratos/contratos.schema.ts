import { z } from 'zod'

export const contratoCreateSchema = z.object({
  temporadaId: z.number().int().positive().optional().nullable(),
  fechaInicio: z.string().date().optional().nullable(),
  fechaTermino: z.string().date().optional().nullable(),
  valoresFacturacion: z.string().max(2000).trim().optional().nullable(),
  condicionesPago: z.string().max(2000).trim().optional().nullable(),
  condicionesFacturacion: z.string().max(2000).trim().optional().nullable(),
  volumenComprometido: z.number().min(0).optional().nullable(),
  unidadVolumen: z.enum(['KG', 'CAJAS']).optional().nullable(),
  minimoGarantizado: z.number().min(0).optional().nullable(),
})

export const contratoUpdateSchema = contratoCreateSchema.partial()

export const contratoParamsSchema = z.object({
  entidadId: z.coerce.number().int().positive(),
  contratoId: z.coerce.number().int().positive(),
})

export const productorParamsSchema = z.object({
  entidadId: z.coerce.number().int().positive(),
})

export type ContratoCreateBody = z.infer<typeof contratoCreateSchema>
export type ContratoUpdateBody = z.infer<typeof contratoUpdateSchema>
