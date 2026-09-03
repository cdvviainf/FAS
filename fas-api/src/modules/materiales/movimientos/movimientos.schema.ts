import { z } from 'zod'

const movimientoDetalleSchema = z.object({
  articuloId: z.number().int().positive(),
  cantidad: z.number().positive('La cantidad debe ser mayor a 0'),
  precioUnitario: z.number().min(0).optional().nullable(),
})

export const movimientoCreateSchema = z.object({
  tipoMovimientoId: z.number().int().positive('El tipo de movimiento es requerido'),
  fechaMovimiento: z.string().datetime({ offset: true }).or(z.string().date()),
})

export const movimientoUpdateSchema = z.object({
  entidadId: z.number().int().positive().optional().nullable(),
  ordenCompraMaterialId: z.number().int().positive().optional().nullable(),
  fechaMovimiento: z.string().datetime({ offset: true }).or(z.string().date()).optional(),
  bodegaOrigenId: z.number().int().positive().optional().nullable(),
  bodegaDestinoId: z.number().int().positive().optional().nullable(),
  guiaReferencia: z.string().max(100).trim().optional().nullable(),
  transporteEntidadId: z.number().int().positive().optional().nullable(),
  choferRut: z.string().max(20).trim().optional().nullable(),
  choferNombre: z.string().max(150).trim().optional().nullable(),
  placaCamion: z.string().max(20).trim().optional().nullable(),
  placaRemolque: z.string().max(20).trim().optional().nullable(),
  horaSalida: z.string().datetime({ offset: true }).optional().nullable(),
  horaEstimadaLlegada: z.string().datetime({ offset: true }).optional().nullable(),
})

export const movimientoDetalleCreateSchema = movimientoDetalleSchema
export const movimientoDetalleUpdateSchema = movimientoDetalleSchema

export const movimientoParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
})

export const movimientoDetalleParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
  detalleId: z.coerce.number().int().positive(),
})

export const movimientoListQuerySchema = z.object({
  tipoMovimientoId: z.coerce.number().int().positive().optional(),
  estado: z.enum(['BORRADOR', 'CONFIRMADO']).optional(),
  fechaDesde: z.string().date().optional(),
  fechaHasta: z.string().date().optional(),
  bodegaId: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(20),
})

export type MovimientoCreateBody = z.infer<typeof movimientoCreateSchema>
export type MovimientoUpdateBody = z.infer<typeof movimientoUpdateSchema>
export type MovimientoDetalleBody = z.infer<typeof movimientoDetalleCreateSchema>
