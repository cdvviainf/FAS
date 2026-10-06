import * as z from 'zod';

export const paisSchema = z.object({
  codigo: z.string().min(1, 'El código es requerido').max(3, 'Máximo 3 caracteres (ISO alfa-3)').toUpperCase(),
  descripcion: z.string().min(1, 'La descripción es requerida').max(200),
  descripcionExtranjera: z.string().max(200).optional(),
  esPaisNacional: z.boolean().default(false),
  puedeSerOrigen: z.boolean().default(false),
  // N:M (2026-10-05): un país puede mapear a varios mercados por empresa.
  mercadoIds: z.array(z.number().int().positive()).min(1, 'Selecciona al menos un mercado')
});

export type PaisFormValues = z.infer<typeof paisSchema>;
