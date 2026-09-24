import { z } from 'zod'

const dimensionSchema = z.enum(['VARIEDAD', 'ARTICULO', 'CALIBRE', 'CATEGORIA', 'MARCA'])

// Misma línea editable que la Proforma: el usuario edita descripción y PRECIO
// UNITARIO; el resto (IDs/cajas) se revalida server-side contra los pallets
// reales del Embarque (reusa validarYCompletarLineas de Proforma). montoLinea se
// deriva de precioUnitario × cajas.
const lineaSchema = z.object({
  descripcion: z.string().trim().min(1),
  especieId: z.number().int().positive(),
  variedadId: z.number().int().positive().optional().nullable(),
  articuloId: z.number().int().positive().optional().nullable(),
  calibreId: z.number().int().positive().optional().nullable(),
  categoriaId: z.number().int().positive().optional().nullable(),
  etiquetaId: z.number().int().positive().optional().nullable(),
  cantidadCajas: z.number().int().positive(),
  precioUnitario: z.number().min(0).max(9_999_999_999),
})

export const facturaExportacionActualizarSchema = z.object({
  dimensiones: z.array(dimensionSchema).default([]),
  lineas: z.array(lineaSchema).min(1, 'Agrega al menos una línea'),
})

export const facturasExportacionListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(20),
  embarqueId: z.coerce.number().int().positive().optional(),
  clienteId: z.coerce.number().int().positive().optional(),
  estado: z.enum(['BORRADOR', 'EMITIDA', 'ANULADA']).optional(),
  folio: z.string().trim().min(1).optional(),
})

export const proformaParamsSchema = z.object({ id: z.coerce.number().int().positive() })
export const facturaParamsSchema = z.object({ id: z.coerce.number().int().positive() })
export const embarqueParamsSchema = z.object({ id: z.coerce.number().int().positive() })

export type FacturaExportacionActualizarBody = z.infer<typeof facturaExportacionActualizarSchema>
export type FacturasExportacionListQuery = z.infer<typeof facturasExportacionListQuerySchema>
