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
// (numeroBooking/nave/numeroContenedor/fechaZarpe/fechaRetiroPlanta),
// tipeados a mano en vez de recibidos por webhook. Al menos un campo debe
// venir con valor (guardar "todo vacío" no tiene sentido). `naviera` salió
// de acá (2026-09-21): pasó a ser `navieraId` (Entidad seleccionable) en
// datosInstructivoSchema, compartido con el Instructivo de Embarque en vez
// de vivir solo en la reserva manual.
export const datosReservaManualSchema = z
  .object({
    numeroBooking: z.string().trim().max(100).optional().nullable(),
    nave: z.string().trim().max(150).optional().nullable(),
    numeroContenedor: z.string().trim().max(50).optional().nullable(),
    fechaZarpe: z.coerce.date().optional().nullable(),
    fechaRetiroPlanta: z.coerce.date().optional().nullable(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined && v !== null && v !== ''), {
    message: 'Debes ingresar al menos un dato de la reserva',
  })

// Datos del Instructivo de Embarque compartidos por todo el Embarque
// (2026-09-21, ventas.md R11 + gap analysis) — independiente de
// reservaManual, editables siempre desde la pestaña "Generar Instructivos".
export const datosInstructivoSchema = z
  .object({
    puertoZarpeId: z.number().int().positive().optional().nullable(),
    voyageNumber: z.string().trim().max(100).optional().nullable(),
    deposito: z.string().trim().max(150).optional().nullable(),
    awbBl: z.string().trim().max(100).optional().nullable(),
    cutoffDate: z.coerce.date().optional().nullable(),
    tipoBultos: z.string().trim().max(150).optional().nullable(),
    agenteAduanaId: z.number().int().positive().optional().nullable(),
    embarcadorId: z.number().int().positive().optional().nullable(),
    navieraId: z.number().int().positive().optional().nullable(),
    fechaArribo: z.coerce.date().optional().nullable(),
    stackingDesde: z.coerce.date().optional().nullable(),
    stackingHasta: z.coerce.date().optional().nullable(),
    observacionesInstructivo: z.string().trim().max(1000).optional().nullable(),
  })
  // FAS-IE-QA-003 (QA ronda 1): antes exigía al menos un valor NO-nulo, lo
  // que impedía volver a dejar el bloque completo en vacío tras haber
  // guardado algo — el frontend siempre manda las 9 llaves (con `null` para
  // "vacío"), así que solo se exige que el payload traiga alguna propiedad
  // (mismo criterio que instructivoHijoUpdateSchema).
  .refine((d) => Object.values(d).some((v) => v !== undefined), {
    message: 'Debes ingresar al menos un dato del Instructivo',
  })

// Edición de un InstructivoHijo (hitos por planta — ventas.md R11): la
// pertenencia (embarqueId/plantaId/secuencia/codigo) es siempre derivada,
// nunca editable a mano.
export const instructivoHijoUpdateSchema = z
  .object({
    fechaCargaPlanta: z.coerce.date().optional().nullable(),
    observaciones: z.string().trim().max(500).optional().nullable(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), {
    message: 'Debes ingresar al menos un dato del instructivo',
  })

export const instructivoHijoParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
  instructivoId: z.coerce.number().int().positive(),
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

// Subida del Excel de Packing List (compras.md §9.3, cierra EP-QA-003) —
// templateCargaId viaja como query param (mismo criterio que ?commit=true en
// carga-maestros.controller.ts), el archivo va en el body multipart.
export const packingListUploadQuerySchema = z.object({
  templateCargaId: z.coerce.number().int().positive('El Template de Carga es requerido'),
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
export type DatosInstructivoBody = z.infer<typeof datosInstructivoSchema>
export type InstructivoHijoUpdateBody = z.infer<typeof instructivoHijoUpdateSchema>
