import { z } from 'zod'

// numeroInstructivo ya no se ingresa manualmente (2026-08-13, ventas.md
// R10 — supersesión): se calcula en el service a partir del folio de la NV
// y el prefijo configurado para su Tipo de Embarque.
export const embarqueCreateSchema = z.object({
  notaVentaId: z.number().int().positive('El Cierre Comercial es requerido'),
})

export const embarqueParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
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
