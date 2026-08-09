import { z } from 'zod'

const instructivoEmbalajeDetalleSchema = z.object({
  articuloId: z.number().int().positive('El artículo de embalaje es requerido'),
  especieId: z.number().int().positive('La especie es requerida'),
  variedadId: z.number().int().positive('La variedad es requerida'),
  categoriaId: z.number().int().positive('La categoría es requerida'),
  calibreIds: z.array(z.number().int().positive()).min(1, 'Selecciona al menos un calibre'),
  tipoPalletId: z.number().int().positive().optional().nullable(),
  cantidadPallets: z.number().int().positive('La cantidad de pallets debe ser mayor a 0'),
  cajasPorPallet: z.number().int().positive('Las cajas por pallet deben ser mayor a 0'),
  cajas: z.number().int().positive('Las cajas deben ser mayor a 0'),
})

export const instructivoEmbalajeCreateSchema = z.object({
  notaVentaId: z.number().int().positive('El Cierre Comercial (Nota de Venta) es requerido'),
  detalle: z.array(instructivoEmbalajeDetalleSchema).min(1, 'El instructivo debe tener al menos una línea'),
})

export const instructivoEmbalajeParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
})

export const instructivoEmbalajeListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  notaVentaId: z.coerce.number().int().positive().optional(),
})

export type InstructivoEmbalajeCreateBody = z.infer<typeof instructivoEmbalajeCreateSchema>
