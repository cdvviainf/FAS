import * as z from 'zod';

export const regionSchema = z.object({
  codigo: z.string().min(1, 'El código es requerido').max(10),
  descripcion: z.string().min(1, 'La descripción es requerida').max(200),
  descripcionExtranjera: z.string().max(200).optional()
});

export type RegionFormValues = z.infer<typeof regionSchema>;
