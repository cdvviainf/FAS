import { z } from 'zod'

const lineaSchema = z.object({
  articuloId: z.number().int().positive('El artículo es requerido'),
  cantidad: z.number().positive('La cantidad debe ser mayor a 0'),
  precioUnitario: z.number().nonnegative('El precio no puede ser negativo'),
  exento: z.boolean().default(false),
})

export const proformaProductorCreateSchema = z.object({
  entidadId: z.number().int().positive('El productor es requerido'),
  monedaId: z.number().int().positive('La moneda es requerida'),
  formaPagoId: z.number().int().positive().optional().nullable(),
  condicionPagoId: z.number().int().positive().optional().nullable(),
  conceptoCtaCteId: z.number().int().positive().optional().nullable(),
  observaciones: z.string().max(2000).trim().optional().nullable(),
  lineas: z.array(lineaSchema).min(1, 'Debe tener al menos una línea'),
})

export const proformaProductorUpdateSchema = proformaProductorCreateSchema.partial()

export const proformaProductorParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
})

export const proformaProductorListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  entidadId: z.coerce.number().int().positive().optional(),
  estado: z.enum(['BORRADOR', 'ENVIADA_VALIDACION', 'RECHAZADA', 'FACTURADA', 'ANULADA']).optional(),
  q: z.string().trim().optional(),
})

export type ProformaProductorCreateBody = z.infer<typeof proformaProductorCreateSchema>
export type ProformaProductorUpdateBody = z.infer<typeof proformaProductorUpdateSchema>
