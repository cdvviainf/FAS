import { z } from 'zod'

const valorEspecieSchema = z.object({
  especieId: z.number().int().positive(),
  valor: z.number(),
})

export const conceptoLiquidacionCreateSchema = z.object({
  codigo: z.string().min(1, 'El código es requerido').max(50).trim(),
  descripcion: z.string().min(1, 'La descripción es requerida').max(200).trim(),
  formaAplicacion: z.enum(['POR_KILO', 'POR_CAJA', 'PORCENTAJE_VENTA', 'MONTO_TOTAL']),
  naturaleza: z.enum(['COBRO', 'ABONO']),
  valores: z
    .array(valorEspecieSchema)
    .refine((v) => new Set(v.map((x) => x.especieId)).size === v.length, {
      message: 'Hay especies repetidas en la matriz de valores (R7)',
    }),
})

export const conceptoLiquidacionUpdateSchema = conceptoLiquidacionCreateSchema.omit({ codigo: true }).partial()

export const conceptoLiquidacionParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
})

export type ConceptoLiquidacionCreateBody = z.infer<typeof conceptoLiquidacionCreateSchema>
export type ConceptoLiquidacionUpdateBody = z.infer<typeof conceptoLiquidacionUpdateSchema>
