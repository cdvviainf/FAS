import { z } from 'zod'

export const cajasPorPalletCreateSchema = z.object({
  articuloId: z.number().int().positive('El embalaje es requerido'),
  tipoPalletId: z.number().int().positive('El tipo de pallet es requerido'),
  cajasPorPallet: z.number().int().positive('Las cajas por pallet deben ser mayor a 0'),
})

export const cajasPorPalletUpdateSchema = cajasPorPalletCreateSchema.partial()

export const cajasPorPalletParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
})

export const cajasPorPalletBuscarSchema = z.object({
  articuloId: z.coerce.number().int().positive(),
  tipoPalletId: z.coerce.number().int().positive(),
})

export const cajasPorPalletListSchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  articuloId: z.coerce.number().int().positive().optional(),
  tipoPalletId: z.coerce.number().int().positive().optional(),
})
