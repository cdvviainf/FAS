import * as z from 'zod';

export const paisSchema = z.object({
  codigo: z.string().min(1, 'El código es requerido').max(3, 'Máximo 3 caracteres (ISO alfa-3)').toUpperCase(),
  descripcion: z.string().min(1, 'La descripción es requerida').max(200),
  descripcionExtranjera: z.string().max(200).optional(),
  esPaisOrigen: z.boolean().default(false)
});

export type PaisFormValues = z.infer<typeof paisSchema>;
