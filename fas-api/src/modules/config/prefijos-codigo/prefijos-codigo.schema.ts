import { z } from 'zod'
import { MODELOS_CON_CODIGO, MODELOS_CON_PREFIJO } from './prefijos-codigo.types.js'

export const prefijoCodigoCreateSchema = z
  .object({
    modelo: z.enum([...MODELOS_CON_PREFIJO]),
    // Solo aplica (y es obligatorio) para modelo='embarque' — un prefijo por
    // Tipo de Embarque, no uno global (ventas.md R10).
    tipoEmbarqueId: z.number().int().positive().optional().nullable(),
    prefijo: z.string().min(1, 'El prefijo es requerido').max(10).trim(),
    digitos: z.number().int().min(1, 'Debe ser al menos 1 dígito').max(10),
  })
  .refine((data) => (data.modelo === 'embarque' ? data.tipoEmbarqueId != null : data.tipoEmbarqueId == null), {
    message: 'El Tipo de Embarque es requerido para el modelo "embarque", y no aplica para el resto',
    path: ['tipoEmbarqueId'],
  })

export const prefijoCodigoUpdateSchema = z.object({
  prefijo: z.string().min(1).max(10).trim().optional(),
  digitos: z.number().int().min(1).max(10).optional(),
})

export const prefijoCodigoParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
})

export const prefijoCodigoModeloParamsSchema = z.object({
  modelo: z.enum([...MODELOS_CON_CODIGO]),
})

export type PrefijoCodigoCreateBody = z.infer<typeof prefijoCodigoCreateSchema>
export type PrefijoCodigoUpdateBody = z.infer<typeof prefijoCodigoUpdateSchema>
