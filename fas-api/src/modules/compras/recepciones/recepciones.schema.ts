import { z } from 'zod'

export const recepcionCreateSchema = z
  .object({
    ordenCompraId: z.number().int().positive().optional().nullable(),
    // Solo tiene sentido sin OC: distingue CONSIGNACION (false/omitido) de
    // PROCESO (true) — Etapa 3, compras.md §7. Con OC el origen siempre es
    // COMPRA, sin importar este campo.
    esProceso: z.boolean().optional(),
    plantaId: z.number().int().positive('La planta es requerida'),
    direccionPlantaId: z.number().int().positive('La dirección de la planta es requerida'),
    templateCargaId: z.number().int().positive().optional().nullable(),
    observaciones: z.string().max(2000).trim().optional().nullable(),
  })
  .refine((data) => !(data.ordenCompraId != null && data.esProceso), {
    message: 'Una Recepción con Orden de Compra no puede marcarse como Proceso',
    path: ['esProceso'],
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
  origen: z.enum(['COMPRA', 'CONSIGNACION', 'PROCESO']).optional(),
  estado: z.enum(['CARGADA', 'VALIDADA', 'RECHAZADA']).optional(),
})

export type RecepcionCreateBody = z.infer<typeof recepcionCreateSchema>
export type RecepcionUpdateBody = z.infer<typeof recepcionUpdateSchema>
