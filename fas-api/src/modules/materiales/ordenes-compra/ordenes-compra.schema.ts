import { z } from 'zod'

const lineaSchema = z.object({
  articuloId: z.number().int().positive('El artículo es requerido'),
  cantidad: z.number().positive('La cantidad debe ser mayor a 0'),
  precioUnitario: z.number().nonnegative('El precio no puede ser negativo'),
})

export const ordenCompraMaterialCreateSchema = z.object({
  entidadProveedorId: z.number().int().positive('El proveedor es requerido'),
  fecha: z.coerce.date().optional(),
  formaPagoId: z.number().int().positive().optional().nullable(),
  condicionPagoId: z.number().int().positive().optional().nullable(),
  monedaId: z.number().int().positive('La moneda es requerida'),
  observaciones: z.string().max(2000).trim().optional().nullable(),
})

export const ordenCompraMaterialUpdateSchema = ordenCompraMaterialCreateSchema.partial()

export const ordenCompraMaterialLineaCreateSchema = lineaSchema
export const ordenCompraMaterialLineaUpdateSchema = lineaSchema

export const ordenCompraMaterialParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
})

export const ordenCompraMaterialLineaParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
  lineaId: z.coerce.number().int().positive(),
})

export const ordenCompraMaterialListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  entidadProveedorId: z.coerce.number().int().positive().optional(),
  estado: z.enum(['BORRADOR', 'EMITIDA', 'RECEPCIONADA']).optional(),
})

export type OrdenCompraMaterialCreateBody = z.infer<typeof ordenCompraMaterialCreateSchema>
export type OrdenCompraMaterialUpdateBody = z.infer<typeof ordenCompraMaterialUpdateSchema>
export type OrdenCompraMaterialLineaCreateBody = z.infer<typeof ordenCompraMaterialLineaCreateSchema>
export type OrdenCompraMaterialLineaUpdateBody = z.infer<typeof ordenCompraMaterialLineaUpdateSchema>
