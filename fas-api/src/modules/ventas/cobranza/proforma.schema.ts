import { z } from 'zod'

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
})

export const proformaEmitirSchema = z.object({
  dimensiones: z.array(dimensionSchema).default([]),
  idioma: z.enum(['EN', 'ES']).default('EN'),
  lineas: z.array(lineaSchema).min(1, 'Agrega al menos una línea'),
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
