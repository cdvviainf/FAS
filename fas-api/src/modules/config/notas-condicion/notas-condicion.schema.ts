import { z } from 'zod'

export const notaCondicionCreateSchema = z.object({
  codigo: z.string().min(1, 'El código es requerido').max(20).trim(),
  descripcion: z.string().min(1, 'La descripción es requerida').max(200).trim(),
  descripcionExtranjera: z.string().max(200).trim().optional(),
  especieIds: z
    .array(z.number().int().positive())
    .refine((v) => new Set(v).size === v.length, { message: 'Hay especies repetidas' }),
})

export const notaCondicionUpdateSchema = notaCondicionCreateSchema.omit({ codigo: true }).partial().extend({
  bloqueado: z.boolean().optional(),
})

export const notaCondicionParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
})

export type NotaCondicionCreateBody = z.infer<typeof notaCondicionCreateSchema>
export type NotaCondicionUpdateBody = z.infer<typeof notaCondicionUpdateSchema>
