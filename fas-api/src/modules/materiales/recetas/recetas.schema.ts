import { z } from 'zod'

const recetaDetalleSchema = z.object({
  componenteId: z.number().int().positive(),
  cantidadAConsumir: z.number().positive('La cantidad a consumir debe ser mayor a 0'),
})

export const recetaCreateSchema = z.object({
  embalajeId: z.number().int().positive('El embalaje es requerido'),
  codigo: z.string().min(1, 'El código es requerido').max(50).trim(),
  descripcion: z.string().min(1, 'La descripción es requerida').max(200).trim(),
  cantidadAProducir: z.number().positive('La cantidad a producir debe ser mayor a 0'),
  activo: z.boolean().default(true),
  detalle: z.array(recetaDetalleSchema).min(1, 'La receta debe tener al menos un componente'),
})

export const recetaUpdateSchema = recetaCreateSchema.omit({ embalajeId: true }).partial()

export const recetaParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
})

export const articuloParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
})

export type RecetaCreateBody = z.infer<typeof recetaCreateSchema>
export type RecetaUpdateBody = z.infer<typeof recetaUpdateSchema>
