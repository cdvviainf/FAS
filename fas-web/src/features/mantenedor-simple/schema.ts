import { z } from 'zod'

export const mantenedorSimpleSchema = z.object({
  codigo: z.string().min(1, 'Requerido').max(50).trim(),
  descripcion: z.string().min(1, 'Requerido').max(200).trim(),
  descripcionExtranjera: z.string().max(200).trim().optional(),
  bloqueado: z.boolean(),
})

export type MantenedorSimpleFormValues = z.infer<typeof mantenedorSimpleSchema>

export const paisSchema = mantenedorSimpleSchema.extend({
  esPaisOrigen: z.boolean().default(false)
})

export type PaisFormValues = z.infer<typeof paisSchema>
