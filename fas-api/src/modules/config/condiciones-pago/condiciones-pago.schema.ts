import { z } from 'zod'

const cuotaSchema = z.object({
  porcentaje: z.number().positive().max(100),
  plazoDias: z.number().int().min(0),
  descripcion: z.string().max(200).trim().optional(),
})

function validarSumaCuotas(cuotas: { porcentaje: number }[]) {
  const suma = cuotas.reduce((acc, c) => acc + c.porcentaje, 0)
  return Math.round(suma * 100) / 100 === 100
}

export const condicionPagoCreateSchema = z.object({
  codigo: z.string().min(1, 'El código es requerido').max(50).trim(),
  descripcion: z.string().min(1, 'La descripción es requerida').max(200).trim(),
  bloqueado: z.boolean().default(false),
  cuotas: z
    .array(cuotaSchema)
    .min(1, 'Debe agregar al menos una cuota')
    .refine(validarSumaCuotas, { message: 'Las cuotas deben sumar 100%' }),
})

export const condicionPagoUpdateSchema = z.object({
  descripcion: z.string().min(1).max(200).trim().optional(),
  bloqueado: z.boolean().optional(),
  cuotas: z
    .array(cuotaSchema)
    .min(1, 'Debe agregar al menos una cuota')
    .refine(validarSumaCuotas, { message: 'Las cuotas deben sumar 100%' })
    .optional(),
})

export const condicionPagoParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
})

export const condicionPagoListQuerySchema = z.object({
  q: z.string().trim().optional(),
})

export type CondicionPagoCreateBody = z.infer<typeof condicionPagoCreateSchema>
export type CondicionPagoUpdateBody = z.infer<typeof condicionPagoUpdateSchema>
