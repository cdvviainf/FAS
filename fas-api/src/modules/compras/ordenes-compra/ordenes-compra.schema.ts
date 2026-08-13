import { z } from 'zod'

const lineaSchema = z.object({
  especieId: z.number().int().positive('La especie es requerida'),
  variedadId: z.number().int().positive('La variedad es requerida'),
  categoriaId: z.number().int().positive('La categoría es requerida'),
  articuloId: z.number().int().positive('El artículo de embalaje es requerido'),
  calibreIds: z.array(z.number().int().positive()).min(1, 'Selecciona al menos un calibre'),
  tipoPalletId: z.number().int().positive().optional().nullable(),
  cantidadPallets: z.number().int().positive('La cantidad de pallets debe ser mayor a 0'),
  cajasPorPallet: z.number().int().positive('Las cajas por pallet deben ser mayor a 0'),
  cajas: z.number().int().positive('Las cajas deben ser mayor a 0'),
  precioUsdCaja: z.number().nonnegative('El precio no puede ser negativo'),
})

export const ordenCompraCreateSchema = z.object({
  entidadProductorId: z.number().int().positive('El productor es requerido'),
  notaVentaId: z.number().int().positive().optional().nullable(),
  solicitudInspeccionId: z.number().int().positive('La inspección de compra es requerida'),
  fecha: z.coerce.date().optional(),
  formaPagoId: z.number().int().positive().optional().nullable(),
  condicionPagoId: z.number().int().positive().optional().nullable(),
  monedaId: z.number().int().positive('La moneda es requerida'),
  destinoMercadoId: z.number().int().positive().optional().nullable(),
  responsableId: z.string().min(1).optional().nullable(),
  // Catálogo genérico Parametro (TipoParametro INCOTERM), mismo mecanismo
  // que NotaVenta.clausulaVentaId — reintroducido 2026-08-12.
  incotermId: z.number().int().positive().optional().nullable(),
  observaciones: z.string().max(2000).trim().optional().nullable(),
})

export const ordenCompraUpdateSchema = z.object({
  entidadProductorId: z.number().int().positive().optional(),
  notaVentaId: z.number().int().positive().optional().nullable(),
  solicitudInspeccionId: z.number().int().positive().optional(),
  fecha: z.coerce.date().optional(),
  formaPagoId: z.number().int().positive().optional().nullable(),
  condicionPagoId: z.number().int().positive().optional().nullable(),
  monedaId: z.number().int().positive().optional(),
  destinoMercadoId: z.number().int().positive().optional().nullable(),
  responsableId: z.string().min(1).optional().nullable(),
  incotermId: z.number().int().positive().optional().nullable(),
  observaciones: z.string().max(2000).trim().optional().nullable(),
  // RECEPCIONADA queda fuera de las transiciones manuales: solo la
  // asignará el futuro flujo de Recepción de Stock (compras.md §4.4/§8),
  // no este endpoint (OC-001).
  estado: z.enum(['BORRADOR', 'EMITIDA']).optional(),
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
