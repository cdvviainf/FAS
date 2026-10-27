import { z } from 'zod'

// N:M (2026-08-22, Etapa 2 — compras.md §4.2): representa un conjunto, no una
// lista con repeticiones — sin este refine, un duplicado (ej. [10, 10]) pasa
// Zod y choca contra el @@unique de la tabla puente como error interno sin
// traducir (FAS-OCSI-003, QA ronda 1).
// 2026-09-15: la Solicitud de Inspección ya NO es requerida en la OC (decisión
// de negocio) — se quitó el .min(1) y del formulario. Sigue siendo vinculable
// (opcional); si se envían, se validan (ver validarReferenciasHeader).
const solicitudInspeccionIdsSchema = z
  .array(z.number().int().positive())
  .refine((ids) => new Set(ids).size === ids.length, {
    message: 'No se puede repetir la misma inspección de compra',
  })

// Línea de OC: la validación FUERTE por modalidad vive en el service
// (ordenes-compra.service.ts), que conoce la modalidad de la OC (cabecera) — por
// eso acá los campos condicionales son opcionales. En CAJAS se exigen categoría/
// calibres/tipo-pallet/pallets/cajas/precio-caja; en GRANEL, kilos/precio-kilo.
const lineaSchema = z.object({
  especieId: z.number().int().positive('La especie es requerida'),
  variedadId: z.number().int().positive('La variedad es requerida'),
  articuloId: z.number().int().positive('El artículo es requerido'),
  // Campos de modalidad CAJAS.
  categoriaId: z.number().int().positive().optional().nullable(),
  // Etiqueta de la línea (2026-10-15): opcional en el request — en CAJAS, si el
  // artículo tiene etiqueta FIJA se resuelve en el service; si es DINÁMICA debe venir.
  etiquetaId: z.number().int().positive().optional().nullable(),
  calibreIds: z.array(z.number().int().positive()).optional().default([]),
  tipoPalletId: z.number().int().positive().optional().nullable(),
  cantidadPallets: z.number().int().positive().optional().nullable(),
  cajasPorPallet: z.number().int().positive().optional().nullable(),
  cajas: z.number().int().positive().optional().nullable(),
  precioUsdCaja: z.number().nonnegative().optional().nullable(),
  // Campos de modalidad GRANEL (2026-10-23): kilos + precio USD por kilo.
  cantidadKilos: z.number().positive().optional().nullable(),
  precioUsdKilo: z.number().nonnegative().optional().nullable(),
})

export const ordenCompraCreateSchema = z.object({
  entidadProductorId: z.number().int().positive('El productor es requerido'),
  notaVentaId: z.number().int().positive().optional().nullable(),
  // N:M (2026-08-22, Etapa 2 — compras.md §4.2): una OC puede tener varias
  // Solicitudes de Inspección. Ya NO es requerida (2026-09-15) — opcional,
  // default vacío.
  solicitudInspeccionIds: solicitudInspeccionIdsSchema.optional().default([]),
  // Modalidad de compra (2026-10-23): CAJAS (fruta embalada) o GRANEL (por kilos).
  modalidad: z.enum(['CAJAS', 'GRANEL']).optional().default('CAJAS'),
  fecha: z.coerce.date().optional(),
  formaPagoId: z.number().int().positive().optional().nullable(),
  condicionPagoId: z.number().int().positive().optional().nullable(),
  monedaId: z.number().int().positive('La moneda es requerida'),
  destinoMercadoId: z.number().int().positive().optional().nullable(),
  responsableId: z.string().min(1).optional().nullable(),
  incotermId: z.number().int().positive().optional().nullable(),
  observaciones: z.string().max(2000).trim().optional().nullable(),
  // Condiciones comerciales de compra a GRANEL (2026-10-27). Solo aplican a
  // modalidad GRANEL; el service las limpia si la OC es CAJAS.
  porcentajeMinExportacion: z.number().min(0).max(100).optional().nullable(),
  modalidadEntregaGranel: z.enum(['PUESTA_EN_CAMPO', 'ENTREGADA_EN_PLANTA']).optional().nullable(),
  envasesProporcionadosPor: z.enum(['PRODUCTOR', 'EXPORTADORA']).optional().nullable(),
  encargadoDescartePor: z.enum(['PRODUCTOR', 'EXPORTADORA']).optional().nullable(),
})

export const ordenCompraUpdateSchema = z.object({
  entidadProductorId: z.number().int().positive().optional(),
  notaVentaId: z.number().int().positive().optional().nullable(),
  // Si viene, reemplaza el conjunto completo (mismo patrón que calibreIds en
  // OrdenCompraLinea) — no se puede enviar vacío, mismo criterio que crear.
  solicitudInspeccionIds: solicitudInspeccionIdsSchema.optional(),
  // Modalidad editable solo en BORRADOR y solo si la OC no tiene líneas (se
  // valida en el service): cambiarla cambia qué campos exige cada línea.
  modalidad: z.enum(['CAJAS', 'GRANEL']).optional(),
  fecha: z.coerce.date().optional(),
  formaPagoId: z.number().int().positive().optional().nullable(),
  condicionPagoId: z.number().int().positive().optional().nullable(),
  monedaId: z.number().int().positive().optional(),
  destinoMercadoId: z.number().int().positive().optional().nullable(),
  responsableId: z.string().min(1).optional().nullable(),
  incotermId: z.number().int().positive().optional().nullable(),
  observaciones: z.string().max(2000).trim().optional().nullable(),
  // Condiciones comerciales de compra a GRANEL (2026-10-27).
  porcentajeMinExportacion: z.number().min(0).max(100).optional().nullable(),
  modalidadEntregaGranel: z.enum(['PUESTA_EN_CAMPO', 'ENTREGADA_EN_PLANTA']).optional().nullable(),
  envasesProporcionadosPor: z.enum(['PRODUCTOR', 'EXPORTADORA']).optional().nullable(),
  encargadoDescartePor: z.enum(['PRODUCTOR', 'EXPORTADORA']).optional().nullable(),
  // RECEPCIONADA queda fuera de las transiciones manuales: solo la
  // asignará el futuro flujo de Recepción de Stock (compras.md §4.4/§8),
  // no este endpoint (OC-001).
  estado: z.enum(['BORRADOR', 'EMITIDA']).optional(),
})

// notaVentaDetalleId solo al crear (2026-08-23) — no se reasigna en un
// PATCH; para cambiar el origen se elimina y se vuelve a agregar la línea.
export const ordenCompraLineaCreateSchema = lineaSchema.extend({
  notaVentaDetalleId: z.number().int().positive().optional().nullable(),
})
export const ordenCompraLineaUpdateSchema = lineaSchema

export const ordenCompraParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
})

export const ordenCompraLineaParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
  lineaId: z.coerce.number().int().positive(),
})

export const disponibilidadCierreParamsSchema = z.object({
  notaVentaId: z.coerce.number().int().positive(),
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
