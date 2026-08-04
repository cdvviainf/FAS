import { z } from 'zod'

const lineaSchema = z.object({
  especieId: z.number().int().positive('La especie es requerida'),
  variedadId: z.number().int().positive('La variedad es requerida'),
  categoriaId: z.number().int().positive('La categoría es requerida'),
  articuloId: z.number().int().positive('El artículo de embalaje es requerido'),
  calibreMinId: z.number().int().positive('El calibre mínimo es requerido'),
  calibreMaxId: z.number().int().positive('El calibre máximo es requerido'),
  cantidadPallets: z.number().int().positive('La cantidad de pallets debe ser mayor a 0'),
  cajasPorPallet: z.number().int().positive('Las cajas por pallet deben ser mayor a 0'),
  precioUsdCaja: z.number().nonnegative('El precio no puede ser negativo'),
})

export const ordenCompraCreateSchema = z.object({
  entidadProductorId: z.number().int().positive('El productor es requerido'),
  notaVentaId: z.number().int().positive().optional().nullable(),
  fecha: z.coerce.date().optional(),
  fechaEntregaDesde: z.string().date().optional().nullable(),
  fechaEntregaHasta: z.string().date().optional().nullable(),
  formaPagoId: z.number().int().positive().optional().nullable(),
  condicionPagoId: z.number().int().positive().optional().nullable(),
  monedaId: z.number().int().positive('La moneda es requerida'),
  incotermId: z.number().int().positive().optional().nullable(),
  destinoMercadoId: z.number().int().positive().optional().nullable(),
  responsableId: z.string().min(1).optional().nullable(),
  observaciones: z.string().max(2000).trim().optional().nullable(),
}).refine(
  (d) => !d.fechaEntregaDesde || !d.fechaEntregaHasta || d.fechaEntregaDesde <= d.fechaEntregaHasta,
  { message: 'La fecha de entrega desde no puede ser posterior a la fecha hasta', path: ['fechaEntregaHasta'] },
)

export const ordenCompraUpdateSchema = z.object({
  entidadProductorId: z.number().int().positive().optional(),
  notaVentaId: z.number().int().positive().optional().nullable(),
  fecha: z.coerce.date().optional(),
  fechaEntregaDesde: z.string().date().optional().nullable(),
  fechaEntregaHasta: z.string().date().optional().nullable(),
  formaPagoId: z.number().int().positive().optional().nullable(),
  condicionPagoId: z.number().int().positive().optional().nullable(),
  monedaId: z.number().int().positive().optional(),
  incotermId: z.number().int().positive().optional().nullable(),
  destinoMercadoId: z.number().int().positive().optional().nullable(),
  responsableId: z.string().min(1).optional().nullable(),
  observaciones: z.string().max(2000).trim().optional().nullable(),
  // RECEPCIONADA queda fuera de las transiciones manuales: solo la
  // asignará el futuro flujo de Recepción de Stock (compras.md §4.4/§8),
  // no este endpoint (OC-001).
  estado: z.enum(['BORRADOR', 'EMITIDA']).optional(),
}).superRefine((d, ctx) => {
  if (d.fechaEntregaDesde && d.fechaEntregaHasta && d.fechaEntregaDesde > d.fechaEntregaHasta) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'La fecha de entrega desde no puede ser posterior a la fecha hasta',
      path: ['fechaEntregaHasta'],
    })
  }
})

export const ordenCompraLineaCreateSchema = lineaSchema
export const ordenCompraLineaUpdateSchema = lineaSchema

export const ordenCompraParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
})

export const ordenCompraLineaParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
  lineaId: z.coerce.number().int().positive(),
})

export const ordenCompraListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  entidadProductorId: z.coerce.number().int().positive().optional(),
  estado: z.enum(['BORRADOR', 'EMITIDA', 'RECEPCIONADA']).optional(),
})

export type OrdenCompraCreateBody = z.infer<typeof ordenCompraCreateSchema>
export type OrdenCompraUpdateBody = z.infer<typeof ordenCompraUpdateSchema>
export type OrdenCompraLineaCreateBody = z.infer<typeof ordenCompraLineaCreateSchema>
export type OrdenCompraLineaUpdateBody = z.infer<typeof ordenCompraLineaUpdateSchema>
