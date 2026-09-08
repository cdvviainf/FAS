import { z } from 'zod'

const MAESTRO_VALUES = ['ENTIDAD', 'ESPECIE', 'TIPO_EMBARQUE', 'PUERTO'] as const

export const integracionCreateSchema = z.object({
  codigo: z.string().min(1, 'El código es requerido').max(50).trim(),
  descripcion: z.string().min(1, 'La descripción es requerida').max(200).trim(),
  url: z.string().url().max(300).optional().nullable(),
  activo: z.boolean().default(true),
  // Gestor Logístico (2026-09-07, ventas.md §4.3) — Entidad tipo
  // GESTOR_LOGISTICO. Si se vincula y la Integración está activa, ese
  // gestor dispara la reserva automática al generar un Embarque; si no,
  // cae a manual. A lo más una Integración por gestor (@@unique).
  gestorLogisticoId: z.number().int().positive().optional().nullable(),
})

export const integracionUpdateSchema = integracionCreateSchema.omit({ codigo: true }).partial()

// Objeto base sin `.refine()` — Zod v4 no permite `.partial()` sobre un schema
// ya refinado (crashea en tiempo de carga del módulo, no en runtime de
// request). El refine se aplica por separado en cada variante (create/update)
// para poder derivar la versión parcial de la base "limpia".
const integracionParametroBaseSchema = z.object({
  idExterno: z.string().min(1, 'El ID externo es requerido').max(100).trim(),
  tipo: z.enum(['TEXTO', 'MAESTRO']).default('TEXTO'),
  maestro: z.enum(MAESTRO_VALUES).optional().nullable(),
  maestroId: z.number().int().positive().optional().nullable(),
  valorLocal: z.string().max(200).trim().optional(),
  valorExterno: z.string().min(1, 'El valor es requerido').max(500),
  sensible: z.boolean().default(false),
  descripcion: z.string().max(500).trim().optional().nullable(),
})

const refinaMaestro = (d: { tipo?: string; maestro?: unknown; maestroId?: unknown }) =>
  d.tipo !== 'MAESTRO' || (d.maestro && d.maestroId)

export const integracionParametroSchema = integracionParametroBaseSchema.refine(refinaMaestro, {
  message: 'Un parámetro tipo Maestro requiere maestro y maestroId',
  path: ['maestro'],
})

export const integracionParametroUpdateSchema = integracionParametroBaseSchema
  .partial()
  .extend({
    // valorExterno es opcional al editar: si se omite, se conserva el valor actual (no se reenvía la máscara)
    valorExterno: z.string().min(1).max(500).optional(),
  })
  // Si `tipo` no viene en el body (no se está cambiando), el chequeo pasa
  // igual — solo exige maestro/maestroId cuando el request pone tipo=MAESTRO explícitamente.
  .refine(refinaMaestro, {
    message: 'Un parámetro tipo Maestro requiere maestro y maestroId',
    path: ['maestro'],
  })

export const integracionParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
})

export const integracionParametroParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
  parametroId: z.coerce.number().int().positive(),
})

export const integracionListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})

export const maestroParamsSchema = z.object({
  maestro: z.enum(MAESTRO_VALUES),
})

export type IntegracionCreateBody = z.infer<typeof integracionCreateSchema>
export type IntegracionUpdateBody = z.infer<typeof integracionUpdateSchema>
export type IntegracionParametroBody = z.infer<typeof integracionParametroSchema>
export type IntegracionParametroUpdateBody = z.infer<typeof integracionParametroUpdateSchema>
