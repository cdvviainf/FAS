import { z } from 'zod'

export const articuloCreateSchema = z.object({
  tipo: z.enum(['EMBALAJE', 'ENVASE', 'MATERIAL_EMBALAJE', 'SERVICIO']),
  codigo: z.string().min(1, 'El código es requerido').max(50).trim(),
  descripcion: z.string().min(1, 'La descripción es requerida').max(200).trim(),
  descripcionExtranjera: z.string().max(200).trim().optional().nullable(),
  unidadId: z.number().int().positive('La unidad de medida es requerida'),
  tipoCosteo: z.enum(['PROMEDIO_PONDERADO', 'ESTANDAR']),
  valorEstandar: z.number().min(0).optional().nullable(),
  stockCritico: z.number().min(0).optional().nullable(),
  activo: z.boolean().default(true),
})

// El código es inmutable (mismo patrón que mantenedores generales)
export const articuloUpdateSchema = articuloCreateSchema.omit({ codigo: true }).partial()

export const articuloParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
})

export const articuloListQuerySchema = z.object({
  q: z.string().max(200).optional(),
  tipo: z.enum(['EMBALAJE', 'ENVASE', 'MATERIAL_EMBALAJE', 'SERVICIO']).optional(),
  // z.coerce.boolean() convierte cualquier string no vacío (incluido "false") a true;
  // se usa un enum explícito para que ?activo=false realmente filtre por false.
  activo: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(20),
})

export type ArticuloCreateBody = z.infer<typeof articuloCreateSchema>
export type ArticuloUpdateBody = z.infer<typeof articuloUpdateSchema>
