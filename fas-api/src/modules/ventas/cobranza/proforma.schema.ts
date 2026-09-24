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
  // Máximo 2 decimales (FAS-PROF-EXP-007, QA ronda 2) — sin esto, sumar
  // montos con más precisión que la moneda arrastra error de punto flotante
  // y `montoTotal` deja de ser exactamente Σ montoLinea.
  montoLinea: z.number().min(0).multipleOf(0.01, 'El monto debe tener máximo 2 decimales'),
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
