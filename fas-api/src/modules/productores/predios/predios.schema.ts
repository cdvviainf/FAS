import { z } from 'zod'

export const predioCreateSchema = z.object({
  codigo: z.string().min(1, 'El código es requerido').max(50).trim(),
  descripcion: z.string().min(1, 'La descripción es requerida').max(200).trim(),
  codigoCsg: z.string().max(50).trim().optional().nullable(),
  nombreCsg: z.string().max(200).trim().optional().nullable(),
  codigoSdp: z.string().max(50).trim().optional().nullable(),
  codigoGgn: z.string().max(50).trim().optional().nullable(),
  direccion: z.string().max(300).trim().optional().nullable(),
  comunaId: z.number().int().positive().optional().nullable(),
  tipoProduccionId: z.number().int().positive().optional().nullable(),
  zonaId: z.number().int().positive().optional().nullable(),
  latitud: z.number().min(-90).max(90).optional().nullable(),
  longitud: z.number().min(-180).max(180).optional().nullable(),
})

export const predioUpdateSchema = predioCreateSchema.omit({ codigo: true }).partial()

export const predioParamsSchema = z.object({
  entidadId: z.coerce.number().int().positive(),
  predioId: z.coerce.number().int().positive(),
})

export const productorParamsSchema = z.object({
  entidadId: z.coerce.number().int().positive(),
})

export type PredioCreateBody = z.infer<typeof predioCreateSchema>
export type PredioUpdateBody = z.infer<typeof predioUpdateSchema>
