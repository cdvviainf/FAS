import { z } from 'zod'

export const palletUpdateSchema = z.object({
  notaCalidadId: z.number().int().positive().nullable().optional(),
  notaCondicionId: z.number().int().positive().nullable().optional(),
  completo: z.boolean().optional(),
})

export const palletParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
})

// Edición de Stock (2026-09-28, permiso OPER_STOCK_EDICION): editar las
// características del lote (pallet + sus líneas: cambiar, agregar, eliminar).
// Solo pallets libres (no reservados ni despachados).
const loteLineaSchema = z.object({
  id: z.number().int().positive().optional(), // existente; ausente = línea nueva
  especieId: z.number().int().positive(),
  variedadId: z.number().int().positive(),
  categoriaId: z.number().int().positive(),
  articuloId: z.number().int().positive(),
  calibreId: z.number().int().positive(),
  cajas: z.number().int().positive(),
  fechaEmbalaje: z.coerce.date().nullable().optional(),
  etiquetaId: z.number().int().positive().nullable().optional(),
  packingId: z.number().int().positive().nullable().optional(),
})

export const loteEditarSchema = z.object({
  productorId: z.number().int().positive().optional(),
  notaCalidadId: z.number().int().positive().nullable().optional(),
  notaCondicionId: z.number().int().positive().nullable().optional(),
  completo: z.boolean().optional(),
  lineas: z.array(loteLineaSchema).min(1, 'El lote debe tener al menos una línea'),
})

export type PalletUpdateBody = z.infer<typeof palletUpdateSchema>
export type LoteEditarBody = z.infer<typeof loteEditarSchema>
