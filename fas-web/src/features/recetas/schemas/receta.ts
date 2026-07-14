import * as z from 'zod';

export const recetaSchema = z.object({
  embalajeId: z.number().positive('Selecciona un embalaje'),
  codigo: z.string().min(1, 'El código es requerido').max(20),
  descripcion: z.string().min(1, 'La descripción es requerida').max(200),
  cantidadAProducir: z.number().positive('Debe ser mayor que 0'),
  activo: z.boolean()
});

export type RecetaFormValues = z.infer<typeof recetaSchema>;
