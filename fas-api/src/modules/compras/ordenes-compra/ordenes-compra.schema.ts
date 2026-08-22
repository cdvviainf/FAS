import { z } from 'zod'

// N:M (2026-08-22, Etapa 2 — compras.md §4.2): representa un conjunto, no una
// lista con repeticiones — sin este refine, un duplicado (ej. [10, 10]) pasa
// Zod y choca contra el @@unique de la tabla puente como error interno sin
// traducir (FAS-OCSI-003, QA ronda 1).
const solicitudInspeccionIdsSchema = z
  .array(z.number().int().positive())
  .min(1, 'La inspección de compra es requerida')
  .refine((ids) => new Set(ids).size === ids.length, {
    message: 'No se puede repetir la misma inspección de compra',
  })

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
  // N:M (2026-08-22, Etapa 2 — compras.md §4.2): una OC puede tener varias
  // Solicitudes de Inspección; al menos 1 requerida a nivel de aplicación
  // (no de schema, mismo criterio que el campo singular anterior).
  solicitudInspeccionIds: solicitudInspeccionIdsSchema,
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
  // Si viene, reemplaza el conjunto completo (mismo patrón que calibreIds en
  // OrdenCompraLinea) — no se puede enviar vacío, mismo criterio que crear.
  solicitudInspeccionIds: solicitudInspeccionIdsSchema.optional(),
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
