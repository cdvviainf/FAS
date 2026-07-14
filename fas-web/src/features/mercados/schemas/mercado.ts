import * as z from 'zod';

export const mercadoSchema = z.object({
  codigo: z.string().min(1, 'El código es requerido').max(20),
  descripcion: z.string().min(1, 'La descripción es requerida').max(200),
  descripcionExtranjera: z.string().max(200).optional(),
  grupoMercadoId: z.coerce.number().min(1, 'Selecciona un grupo de mercado'),
  paisId: z.coerce.number().min(1, 'Selecciona un país')
});

export type MercadoFormValues = z.infer<typeof mercadoSchema>;
