import { z } from 'zod'

export const recepcionCreateSchema = z.object({
  ordenCompraId: z.number().int().positive().optional().nullable(),
  plantaId: z.number().int().positive('La planta es requerida'),
  direccionPlantaId: z.number().int().positive('La dirección de la planta es requerida'),
  templateCargaId: z.number().int().positive().optional().nullable(),
  observaciones: z.string().max(2000).trim().optional().nullable(),
})

export const recepcionUpdateSchema = z.object({
  plantaId: z.number().int().positive().optional(),
  direccionPlantaId: z.number().int().positive().optional(),
  templateCargaId: z.number().int().positive().optional().nullable(),
  observaciones: z.string().max(2000).trim().optional().nullable(),
})

export const recepcionParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
})

export const recepcionAdjuntoParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
  adjuntoId: z.coerce.number().int().positive(),
})

export const recepcionListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  plantaId: z.coerce.number().int().positive().optional(),
  origen: z.enum(['COMPRA', 'CONSIGNACION']).optional(),
  estado: z.enum(['CARGADA', 'VALIDADA', 'RECHAZADA']).optional(),
})

export type RecepcionCreateBody = z.infer<typeof recepcionCreateSchema>
export type RecepcionUpdateBody = z.infer<typeof recepcionUpdateSchema>
