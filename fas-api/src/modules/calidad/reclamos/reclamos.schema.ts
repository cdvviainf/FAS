import { z } from 'zod'

const lineaSchema = z.object({
  palletLineaId: z.number().int().positive(),
  cantidadCajas: z.number().int().positive('La cantidad de cajas debe ser mayor a 0'),
})

// IMP-QA-R2-025: dos entradas con el mismo palletLineaId en el mismo body
// terminaban en una violación del índice único (500) en vez de un 422 —
// se rechaza acá, antes de llegar al repository.
function lineasSchema(mensajeMinimo: string) {
  return z
    .array(lineaSchema)
    .min(1, mensajeMinimo)
    .refine(
      (lineas) => new Set(lineas.map((l) => l.palletLineaId)).size === lineas.length,
      { message: 'No se puede marcar la misma línea de pallet dos veces en el mismo Reclamo' },
    )
}

// La Provisión inline (al crear el Reclamo) usa el mismo shape que crear una
// Provisión aparte — ver provisionCreateSchema más abajo. `cantidadAfectada`
// es opcional acá: si no viene, el service la sugiere desde las líneas
// marcadas (RC-D10, "sugerida... editable").
const tipoCalculoSchema = z.enum(['POR_UNIDAD_CAJA', 'POR_PESO_KILO', 'MONTO_FIJO'])

function refineProvision<T extends { tipoCalculo: string; valorUnitario?: number | null; montoFijo?: number | null }>(
  data: T,
  ctx: z.RefinementCtx,
) {
  if (data.tipoCalculo === 'MONTO_FIJO') {
    if (data.montoFijo == null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['montoFijo'], message: 'El monto fijo es requerido' })
    }
  } else if (data.valorUnitario == null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['valorUnitario'], message: 'El valor unitario es requerido' })
  }
}

const provisionBaseSchema = z.object({
  tipoCalculo: tipoCalculoSchema,
  valorUnitario: z.number().positive().optional().nullable(),
  cantidadAfectada: z.number().positive().optional().nullable(),
  montoFijo: z.number().positive().optional().nullable(),
})

export const provisionCreateSchema = provisionBaseSchema.superRefine(refineProvision)

export const reclamoCreateSchema = z.object({
  fechaReclamo: z.string().date().optional().nullable(),
  resumenCliente: z.string().trim().max(2000).optional().nullable(),
  temporadaId: z.number().int().positive().optional().nullable(),
  lineas: lineasSchema('Selecciona al menos una línea de pallet'),
  provision: provisionBaseSchema.superRefine(refineProvision).optional().nullable(),
})

// IMP-QA-R1-019: edición — todo opcional (PATCH parcial), pero si viene
// `lineas` exige al menos una (reemplaza el set completo, no tiene sentido
// "editar a cero líneas" — para eso existe el cierre/anulación).
export const reclamoUpdateSchema = z.object({
  fechaReclamo: z.string().date().optional().nullable(),
  resumenCliente: z.string().trim().max(2000).optional().nullable(),
  temporadaId: z.number().int().positive().optional().nullable(),
  lineas: lineasSchema('Selecciona al menos una línea de pallet').optional(),
})

export const analisisCalidadSchema = z.object({
  comentarioCalidad: z.string().trim().min(1).max(5000),
})

export const valorizarSchema = z.object({
  valorConfirmado: z.number().min(0, 'El monto confirmado no puede ser negativo'),
})

export const cerrarSchema = z.object({
  procedencia: z.enum(['PROCEDENTE', 'IMPROCEDENTE', 'PARCIAL']),
})

export const reclamosListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(20),
  estado: z.enum(['INGRESADO', 'VALORIZADO', 'CERRADO']).optional(),
  embarqueId: z.coerce.number().int().positive().optional(),
  clienteId: z.coerce.number().int().positive().optional(),
  // IMP-QA-R1-022: búsqueda por folio (numeroInstructivo) del Embarque.
  folio: z.string().trim().min(1).optional(),
})

export const reclamoParamsSchema = z.object({ id: z.coerce.number().int().positive() })
export const embarqueReclamosParamsSchema = z.object({ id: z.coerce.number().int().positive() })
export const reclamoDocumentoParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
  documentoId: z.coerce.number().int().positive(),
})
export const provisionParamsSchema = z.object({ id: z.coerce.number().int().positive() })

export type ReclamoCreateBody = z.infer<typeof reclamoCreateSchema>
export type ReclamoUpdateBody = z.infer<typeof reclamoUpdateSchema>
export type ProvisionCreateBody = z.infer<typeof provisionCreateSchema>
export type AnalisisCalidadBody = z.infer<typeof analisisCalidadSchema>
export type ValorizarBody = z.infer<typeof valorizarSchema>
export type CerrarBody = z.infer<typeof cerrarSchema>
export type ReclamosListQuery = z.infer<typeof reclamosListQuerySchema>
