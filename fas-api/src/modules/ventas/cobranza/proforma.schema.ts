import { z } from 'zod'
import { fechaDocumentoRequeridaSchema } from './fecha-documento.schema.js'

const dimensionSchema = z.enum(['VARIEDAD', 'ARTICULO', 'CALIBRE', 'CATEGORIA', 'MARCA'])

// GET .../proforma/sugerencia?dimensiones=VARIEDAD,CATEGORIA — lista separada
// por comas en la query string, igual criterio que otros filtros del sistema.
export const sugerenciaQuerySchema = z.object({
  dimensiones: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(',').filter(Boolean) : []))
    .pipe(z.array(dimensionSchema)),
})

// "Separar cantidades" (2026-11-10): sublínea opcional con texto libre y valor
// unitario por la MISMA cantidad de cajas de la línea (p. ej. "CAJAS PLASTICAS"
// a USD 0,50). El precio de la línea es el de la fruta (ya descontado). El texto
// va como NmbItem del DTE 110, que el SII limita a 80 caracteres.
export const separacionLineaSchema = z
  .object({
    descripcion: z.string().trim().min(1, 'Indica el texto de la cantidad separada').max(80),
    precioUnitario: z.number().positive('El valor separado debe ser mayor a 0').max(9_999_999_999),
  })
  .nullable()
  .optional()

const lineaSchema = z.object({
  descripcion: z.string().trim().min(1),
  especieId: z.number().int().positive(),
  variedadId: z.number().int().positive().optional().nullable(),
  articuloId: z.number().int().positive().optional().nullable(),
  calibreId: z.number().int().positive().optional().nullable(),
  categoriaId: z.number().int().positive().optional().nullable(),
  etiquetaId: z.number().int().positive().optional().nullable(),
  cantidadCajas: z.number().int().positive(),
  // El usuario edita el PRECIO UNITARIO (decisión de negocio, Christian
  // 2026-09-24): el monto de línea (= precio × cajas) y el total se derivan
  // server-side. Se admiten hasta 4 decimales (igual que la columna
  // ProformaLinea.precioUnitario @db.Decimal(14,4)); la suma sigue siendo
  // exacta porque montoLinea se redondea a 2 decimales antes de sumar en
  // centavos (FAS-PROF-EXP-007, QA ronda 2).
  precioUnitario: z.number().min(0).max(9_999_999_999),
  separacion: separacionLineaSchema,
})

export const proformaEmitirSchema = z.object({
  dimensiones: z.array(dimensionSchema).default([]),
  idioma: z.enum(['EN', 'ES']).default('EN'),
  // Fecha del documento "YYYY-MM-DD" — OBLIGATORIA (no se emite sin fecha).
  fechaDocumento: fechaDocumentoRequeridaSchema,
  lineas: z.array(lineaSchema).min(1, 'Agrega al menos una línea'),
  // Flete/Seguro de la cláusula de venta (Incoterm). Solo se exigen si la
  // cláusula lo indica (validación server-side, no aquí, porque depende de un
  // dato de la Nota de Venta). No negativos; el service redondea a 2 decimales.
  fleteSumaAlPrecio: z.boolean().optional(),
  montoFlete: z.number().min(0).max(9_999_999_999).optional().nullable(),
  montoSeguro: z.number().min(0).max(9_999_999_999).optional().nullable(),
  // Observaciones libres del documento. Se copian a la Factura y de ahí al DTE
  // 110 como Encabezado.IdDoc.TermPagoGlosa, que el SII limita a 100 caracteres.
  observaciones: z.string().trim().max(100).optional().nullable(),
})

export const proformasListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(20),
  embarqueId: z.coerce.number().int().positive().optional(),
  clienteId: z.coerce.number().int().positive().optional(),
  estado: z.enum(['EMITIDA', 'ANULADA']).optional(),
  folio: z.string().trim().min(1).optional(),
})

export const embarqueParamsSchema = z.object({ id: z.coerce.number().int().positive() })
export const proformaParamsSchema = z.object({ id: z.coerce.number().int().positive() })

export type SugerenciaQuery = z.infer<typeof sugerenciaQuerySchema>
export type ProformaEmitirBody = z.infer<typeof proformaEmitirSchema>
export type ProformasListQuery = z.infer<typeof proformasListQuerySchema>
