import { z } from 'zod'

export const mantenedorSimpleSchema = z.object({
  codigo: z.string().min(1, 'Requerido').max(50).trim(),
  descripcion: z.string().min(1, 'Requerido').max(200).trim(),
  descripcionExtranjera: z.string().max(200).trim().optional(),
  bloqueado: z.boolean(),
})

export type MantenedorSimpleFormValues = z.infer<typeof mantenedorSimpleSchema>

export const paisSchema = mantenedorSimpleSchema.extend({
  // Refleja la misma regla del backend (paisBodySchema): código ISO alfa-3.
  // Sin esto, el error solo se veía tras el round-trip al API ("Datos inválidos").
  codigo: z
    .string()
    .length(3, 'El código de país debe ser ISO alfa-3 (3 letras)')
    .regex(/^[A-Z]{3}$/, 'El código debe ser 3 letras mayúsculas (ej: CHL, USA)')
    .trim(),
  esPaisOrigen: z.boolean().default(false)
})

export type PaisFormValues = z.infer<typeof paisSchema>
