import { z } from 'zod'

const idPos = z.coerce.number().int().positive()

export const despachadoQuerySchema = z.object({
  entidadProductorId: idPos,
  ordenCompraId: idPos.optional(),
  embarqueId: idPos.optional(),
  temporadaId: idPos.optional(),
  // Al editar una solicitud: su propio monto no descuenta el saldo.
  excluirSolicitudId: idPos.optional(),
})

export const solicitudesListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(20),
  entidadProductorId: idPos.optional(),
  estado: z.enum(['SOLICITADA', 'PAGADA', 'ANULADA']).optional(),
  temporadaId: idPos.optional(),
  q: z.string().trim().min(1).optional(),
})

export const solicitudParamsSchema = z.object({ id: idPos })

const lineaSchema = z.object({
  ordenCompraId: z.number().int().positive(),
  embarqueId: z.number().int().positive(),
  // null = cuota implícita (OC sin condición de pago).
  ordenCompraCuotaPagoId: z.number().int().positive().nullable(),
  montoSolicitado: z.number().positive('El monto solicitado debe ser mayor a 0').max(9_999_999_999),
})

const lineasSchema = z
  .array(lineaSchema)
  .min(1, 'Selecciona al menos una cuota')
  .refine(
    (ls) => new Set(ls.map((l) => `${l.ordenCompraId}|${l.embarqueId}|${l.ordenCompraCuotaPagoId ?? 'total'}`)).size === ls.length,
    { message: 'Hay cuotas repetidas en la solicitud' },
  )

export const solicitudCreateSchema = z.object({
  entidadProductorId: z.number().int().positive(),
  // Temporada activa del selector general (obligatoria, 2026-11-09).
  temporadaId: z.number().int().positive().nullable().optional(),
  observaciones: z.string().trim().max(1000).nullable().optional(),
  lineas: lineasSchema,
})

export const solicitudUpdateSchema = z.object({
  observaciones: z.string().trim().max(1000).nullable().optional(),
  lineas: lineasSchema,
})

export const confirmarPagoSchema = z.object({
  fechaPago: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha de pago inválida (AAAA-MM-DD)'),
  conceptoCtaCteId: z.number().int().positive('Selecciona el concepto de cuenta corriente'),
  numeroTransferencia: z.string().trim().max(100).nullable().optional(),
  // N° de factura del productor por cuota (obligatorio en todas).
  facturas: z
    .array(z.object({ lineaId: z.number().int().positive(), numeroFactura: z.string().trim().min(1, 'Indica el N° de factura').max(50) }))
    .min(1),
})

export type DespachadoQuery = z.infer<typeof despachadoQuerySchema>
export type SolicitudesListQuery = z.infer<typeof solicitudesListQuerySchema>
export type SolicitudCreateBody = z.infer<typeof solicitudCreateSchema>
export type SolicitudUpdateBody = z.infer<typeof solicitudUpdateSchema>
export type ConfirmarPagoBody = z.infer<typeof confirmarPagoSchema>
