import { z } from 'zod'

const cuotaSchema = z
  .object({
    fechaReferencia: z.enum(['FACTURA', 'ZARPE', 'ENVIO_DOCUMENTOS']).default('FACTURA'),
    plazoDias: z.number().int().min(0),
    tipoValor: z.enum(['PORCENTAJE', 'MONTO_UNITARIO']).default('PORCENTAJE'),
    porcentaje: z.number().positive().max(100).optional().nullable(),
    valorUnitario: z.number().positive().optional().nullable(),
    monedaId: z.number().int().positive().optional().nullable(),
    unidadId: z.number().int().positive().optional().nullable(),
    descripcion: z.string().max(200).trim().optional(),
  })
  .superRefine((c, ctx) => {
    if (c.tipoValor === 'PORCENTAJE') {
      if (c.porcentaje == null) {
        ctx.addIssue({ code: 'custom', message: 'El porcentaje es requerido', path: ['porcentaje'] })
      }
    } else {
      if (c.valorUnitario == null) {
        ctx.addIssue({ code: 'custom', message: 'El valor unitario es requerido', path: ['valorUnitario'] })
      }
      if (c.monedaId == null) {
        ctx.addIssue({ code: 'custom', message: 'La moneda es requerida', path: ['monedaId'] })
      }
      if (c.unidadId == null) {
        ctx.addIssue({ code: 'custom', message: 'La unidad (Caja/Kilo) es requerida', path: ['unidadId'] })
      }
    }
  })

// R12b: a lo sumo UNA cuota MONTO_UNITARIO por condición, y debe ser la
// primera (índice 0) — es un cargo adicional, nunca reemplaza el 100% del
// documento. Las cuotas PORCENTAJE son siempre obligatorias y deben sumar
// exactamente 100% entre sí, exista o no además esa cuota MONTO_UNITARIO.
function validarCuotas(cuotas: { tipoValor: string; porcentaje?: number | null }[]) {
  const cuotasMontoUnitario = cuotas.filter((c) => c.tipoValor === 'MONTO_UNITARIO')
  if (cuotasMontoUnitario.length > 1) return false
  if (cuotasMontoUnitario.length === 1 && cuotas[0]?.tipoValor !== 'MONTO_UNITARIO') return false

  const porcentuales = cuotas.filter((c) => c.tipoValor === 'PORCENTAJE')
  if (porcentuales.length === 0) return false

  const suma = porcentuales.reduce((acc, c) => acc + (c.porcentaje ?? 0), 0)
  return Math.round(suma * 100) / 100 === 100
}

const MENSAJE_CUOTAS = 'La cuota con monto unitario debe ser la primera y es un cargo adicional — siempre debe haber además cuotas por porcentaje que sumen 100%'

export const condicionPagoCreateSchema = z.object({
  codigo: z.string().min(1, 'El código es requerido').max(50).trim(),
  descripcion: z.string().min(1, 'La descripción es requerida').max(200).trim(),
  tipo: z.enum(['COMPRA', 'VENTA'], { message: 'El tipo (Compra/Venta) es requerido' }),
  bloqueado: z.boolean().default(false),
  cuotas: z
    .array(cuotaSchema)
    .min(1, 'Debe agregar al menos una cuota')
    .refine(validarCuotas, { message: MENSAJE_CUOTAS }),
})

export const condicionPagoUpdateSchema = z.object({
  descripcion: z.string().min(1).max(200).trim().optional(),
  bloqueado: z.boolean().optional(),
  cuotas: z
    .array(cuotaSchema)
    .min(1, 'Debe agregar al menos una cuota')
    .refine(validarCuotas, { message: MENSAJE_CUOTAS })
    .optional(),
})

export const condicionPagoParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
})

export const condicionPagoListQuerySchema = z.object({
  q: z.string().trim().optional(),
  tipo: z.enum(['COMPRA', 'VENTA']).optional(),
})

export type CondicionPagoCreateBody = z.infer<typeof condicionPagoCreateSchema>
export type CondicionPagoUpdateBody = z.infer<typeof condicionPagoUpdateSchema>
