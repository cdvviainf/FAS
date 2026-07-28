import * as z from 'zod';

export const paisSchema = z.object({
  codigo: z.string().min(1, 'El código es requerido').max(3, 'Máximo 3 caracteres (ISO alfa-3)').toUpperCase(),
  descripcion: z.string().min(1, 'La descripción es requerida').max(200),
  descripcionExtranjera: z.string().max(200).optional(),
  esPaisNacional: z.boolean().default(false),
  puedeSerOrigen: z.boolean().default(false),
  mercadoId: z.coerce.number().int().positive('Selecciona un mercado')
});

export type PaisFormValues = z.infer<typeof paisSchema>;
