import { z } from 'zod'

export const contratoLineaSchema = z.object({
  articuloId: z.number().int().positive(),
  variedadId: z.number().int().positive(),
  calibreDesdeId: z.number().int().positive(),
  calibreHastaId: z.number().int().positive(),
  categoriaId: z.number().int().positive(),
  unidadMedidaId: z.number().int().positive(),
  cantidadComprometida: z.number().min(0),
  minimoGarantizado: z.number().min(0),
})

export const contratoCreateSchema = z.object({
  temporadaId: z.number().int().positive(),
  especieId: z.number().int().positive(),
  fechaInicio: z.string().date(),
  fechaTermino: z.string().date(),
  condicionPagoId: z.number().int().positive().optional().nullable(),
  responsableId: z.string().min(1).optional().nullable(),
  lineas: z.array(contratoLineaSchema).min(1, 'Debe agregar al menos una línea de características'),
}).refine((d) => d.fechaInicio <= d.fechaTermino, {
  message: 'La fecha de inicio no puede ser posterior a la fecha de término',
  path: ['fechaTermino'],
})

export const contratoUpdateSchema = z.object({
  temporadaId: z.number().int().positive().optional(),
  especieId: z.number().int().positive().optional(),
  fechaInicio: z.string().date().optional(),
  fechaTermino: z.string().date().optional(),
  condicionPagoId: z.number().int().positive().optional().nullable(),
  responsableId: z.string().min(1).optional().nullable(),
  lineas: z.array(contratoLineaSchema).min(1, 'Debe agregar al menos una línea de características').optional(),
}).superRefine((d, ctx) => {
  if (d.fechaInicio && d.fechaTermino && d.fechaInicio > d.fechaTermino) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'La fecha de inicio no puede ser posterior a la fecha de término',
      path: ['fechaTermino'],
    })
  }
})

export const contratoParamsSchema = z.object({
  entidadId: z.coerce.number().int().positive(),
  contratoId: z.coerce.number().int().positive(),
})

export const productorParamsSchema = z.object({
  entidadId: z.coerce.number().int().positive(),
})

export type ContratoCreateBody = z.infer<typeof contratoCreateSchema>
export type ContratoUpdateBody = z.infer<typeof contratoUpdateSchema>
