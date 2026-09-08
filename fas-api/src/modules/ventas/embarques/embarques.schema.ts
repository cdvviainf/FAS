import { z } from 'zod'

// numeroInstructivo ya no se ingresa manualmente (2026-08-13, ventas.md
// R10 — supersesión): se calcula en el service a partir del folio de la NV
// y el prefijo configurado para su Tipo de Embarque.
// gestorLogisticoId (2026-09-07, ventas.md §4.3 — generaliza el hardcode a
// AGL360): obligatorio, se elige junto con el resto de datos al generar el
// Embarque. Si el gestor tiene una Integración API activa vinculada, se
// intenta la reserva automática (igual que antes); si no, el Embarque nace
// directo en modo manual (reservaManual=true).
export const embarqueCreateSchema = z.object({
  notaVentaId: z.number().int().positive('El Cierre Comercial es requerido'),
  gestorLogisticoId: z.number().int().positive('El Gestor Logístico es requerido'),
  forzarSinReserva: z.boolean().optional(),
})

// "Dejar Manual" (2026-09-07): sin body — solo marca el Embarque como
// reservaManual=true tras un fallo de la integración automática.
export const dejarReservaManualSchema = z.object({})

// Guardar datos de booking manual — mismo shape que SolicitudReserva
// (numeroBooking/naviera/nave/numeroContenedor/fechaZarpe/fechaRetiroPlanta),
// tipeados a mano en vez de recibidos por webhook. Al menos un campo debe
// venir con valor (guardar "todo vacío" no tiene sentido).
export const datosReservaManualSchema = z
  .object({
    numeroBooking: z.string().trim().max(100).optional().nullable(),
    naviera: z.string().trim().max(150).optional().nullable(),
    nave: z.string().trim().max(150).optional().nullable(),
    numeroContenedor: z.string().trim().max(50).optional().nullable(),
    fechaZarpe: z.coerce.date().optional().nullable(),
    fechaRetiroPlanta: z.coerce.date().optional().nullable(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined && v !== null && v !== ''), {
    message: 'Debes ingresar al menos un dato de la reserva',
  })

// Webhook AGL360 -> FAS (Docs/webhook-fas.md, contrato real 2026-09-07):
// notifica que una SolicitudServicio creada por la API se aprobó y generó
// una OrdenServicio. Sin sesión de usuario — autenticado por firma HMAC
// (ver embarques.routes.ts/auth-guard.ts). No trae `empresaId` (el body es
// 100% de AGL360, no lo diseñamos nosotros) — se deriva de
// `referencia_externa`, que FAS genera con el formato determinístico
// `AGL-{empresaId}-{notaVentaId}` (ver embarques.service.ts).
// `evento` es literal porque hoy "orden.creada" es el único evento que
// existe — si AGL360 agrega uno nuevo, este schema debe actualizarse a
// propósito (falla explícita en vez de aceptar silenciosamente algo no
// contemplado).
export const aglWebhookConfirmarSchema = z.object({
  evento: z.literal('orden.creada'),
  idOrdenServicio: z.number().int().positive(),
  idSolicitudServicio: z.number().int().positive(),
  referencia_externa: z.string().min(1),
  estadoOrden: z.string().min(1),
})

export const embarqueParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
})

// Edición de un Reclamo (IMP-QA-R1-019, reclamos.md §6) — anidado bajo el
// Embarque: :id es el Embarque, :reclamoId el Reclamo.
export const embarqueReclamoParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
  reclamoId: z.coerce.number().int().positive(),
})

export const embarqueListQuerySchema = z.object({
  notaVentaId: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(500).default(20),
})

// Selección de Pallets (ventas.md R8/R9) — reserva en bloque.
export const reservarPalletsSchema = z.object({
  palletIds: z.array(z.number().int().positive()).min(1, 'Debes seleccionar al menos un pallet'),
})

export const embarquePalletParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
  palletId: z.coerce.number().int().positive(),
})

export type EmbarqueCreateBody = z.infer<typeof embarqueCreateSchema>
export type ReservarPalletsBody = z.infer<typeof reservarPalletsSchema>
export type AglWebhookConfirmarBody = z.infer<typeof aglWebhookConfirmarSchema>
export type DatosReservaManualBody = z.infer<typeof datosReservaManualSchema>
