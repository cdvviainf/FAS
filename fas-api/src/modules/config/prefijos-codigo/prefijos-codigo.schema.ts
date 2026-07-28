import { z } from 'zod'
import { MODELOS_CON_CODIGO } from './prefijos-codigo.types.js'

export const prefijoCodigoCreateSchema = z.object({
  modelo: z.enum([...MODELOS_CON_CODIGO]),
  prefijo: z.string().min(1, 'El prefijo es requerido').max(10).trim(),
  digitos: z.number().int().min(1, 'Debe ser al menos 1 dígito').max(10),
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
