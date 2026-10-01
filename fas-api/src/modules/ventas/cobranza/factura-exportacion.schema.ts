import { z } from 'zod'
import { fechaDocumentoSchema } from './fecha-documento.schema.js'

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
  // Idioma del documento (ES/EN) y fecha del documento — editables en BORRADOR.
  idioma: z.enum(['ES', 'EN']).default('EN'),
  // Fecha del documento como "YYYY-MM-DD" (input date) o ISO — validada estricta.
  fechaDocumento: fechaDocumentoSchema,
  // Flete/Seguro de la cláusula de venta (Incoterm). Solo se exigen si la
  // cláusula lo indica (validación server-side). El service redondea a 2 dec.
  montoFlete: z.number().min(0).max(9_999_999_999).optional().nullable(),
  montoSeguro: z.number().min(0).max(9_999_999_999).optional().nullable(),
  // Tipo de cambio (pesos por unidad de la moneda extranjera) — editable en
  // BORRADOR; se sugiere desde el Banco Central al crear la factura. Lo exige el
  // SII para emitir en moneda extranjera (validación server-side al enviar al SII).
  tipoCambio: z.number().positive().max(999_999.9999).optional().nullable(),
  // Fecha de la paridad observada (trazabilidad). La envía el frontend cuando el
  // valor viene de "Obtener" (fecha real del Banco Central); en ingreso manual
  // llega null y el service sella con la fecha de edición. BRT-R1-003.
  fechaTipoCambio: z.string().date().optional().nullable(),
})

export const embarquesDespachadosQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(20),
  folio: z.string().trim().min(1).optional(),
  clienteId: z.coerce.number().int().positive().optional(),
})

export const facturasExportacionListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(20),
  embarqueId: z.coerce.number().int().positive().optional(),
  clienteId: z.coerce.number().int().positive().optional(),
  estado: z.enum(['BORRADOR', 'APROBADA', 'RECHAZADA', 'ANULADA']).optional(),
  folio: z.string().trim().min(1).optional(),
})

export const proformaParamsSchema = z.object({ id: z.coerce.number().int().positive() })
export const facturaParamsSchema = z.object({ id: z.coerce.number().int().positive() })
export const embarqueParamsSchema = z.object({ id: z.coerce.number().int().positive() })

export type FacturaExportacionActualizarBody = z.infer<typeof facturaExportacionActualizarSchema>
export type FacturasExportacionListQuery = z.infer<typeof facturasExportacionListQuerySchema>
