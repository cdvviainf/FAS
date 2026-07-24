import { z } from 'zod'

export const notaVentaCreateSchema = z.object({
  fecha: z.coerce.date(),
  clienteId: z.number().int().positive('El cliente es requerido'),
  compradorId: z.number().int().positive().optional().nullable(),
  notifyId: z.number().int().positive().optional().nullable(),
  clienteFinalId: z.number().int().positive().optional().nullable(),
  tipoEmbarqueId: z.number().int().positive('El tipo de embarque es requerido'),
  mercadoId: z.number().int().positive('El mercado es requerido'),
  paisDestinoId: z.number().int().positive('El país destino es requerido'),
  puertoDestinoId: z.number().int().positive().optional().nullable(),
  direccionId: z.number().int().positive().optional().nullable(),
  direccionDetalle: z.string().max(300).trim().optional().nullable(),
  modalidadVentaId: z.number().int().positive().optional().nullable(),
  clausulaVentaId: z.number().int().positive().optional().nullable(),
  tipoFleteId: z.number().int().positive().optional().nullable(),
  formaPagoId: z.number().int().positive().optional().nullable(),
  saldoPagoId: z.number().int().positive().optional().nullable(),
  monedaId: z.number().int().positive('La moneda es requerida'),
  observaciones: z.string().max(1000).trim().optional().nullable(),
})

export const notaVentaUpdateSchema = notaVentaCreateSchema.partial()

export const notaVentaDetalleCreateSchema = z.object({
  fechaCompromiso: z.coerce.date(),
  especieId: z.number().int().positive('La especie es requerida'),
  variedadId: z.number().int().positive('La variedad es requerida'),
  articuloId: z.number().int().positive('El artículo de embalaje es requerido'),
  categoriaId: z.number().int().positive().optional().nullable(),
  tipoPalletId: z.number().int().positive().optional().nullable(),
  cantidadPallets: z.number().int().positive('La cantidad de pallets debe ser mayor a 0'),
  cajasPorPallet: z.number().int().positive('Las cajas por pallet deben ser mayor a 0'),
  cajas: z.number().int().positive('Las cajas deben ser mayor a 0'),
  precio: z.number().positive('El precio debe ser mayor a 0'),
  calibreIds: z.array(z.number().int().positive()).min(1, 'Debe seleccionar al menos un calibre'),
})

export const notaVentaParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
})

export const notaVentaListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  clienteId: z.coerce.number().int().positive().optional(),
})

export type NotaVentaCreateBody = z.infer<typeof notaVentaCreateSchema>
export type NotaVentaUpdateBody = z.infer<typeof notaVentaUpdateSchema>
export type NotaVentaDetalleCreateBody = z.infer<typeof notaVentaDetalleCreateSchema>
