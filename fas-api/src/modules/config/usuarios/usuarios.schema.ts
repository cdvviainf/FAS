import { z } from 'zod'

export const usuarioCreateSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido').max(200).trim(),
  email: z.string().email('Email inválido').max(200).toLowerCase().trim(),
  whatsapp: z.string().max(50).trim().optional(),
  perfilId: z.number().int().positive('El perfil es requerido'),
  esResponsableVenta: z.boolean().default(false),
  password: z.string().min(1, 'La contraseña es requerida'),
  passwordConfirm: z.string().min(1, 'Confirma la contraseña'),
})

export const usuarioUpdateSchema = z.object({
  nombre: z.string().min(1).max(200).trim().optional(),
  whatsapp: z.string().max(50).trim().optional().nullable(),
  perfilId: z.number().int().positive().optional(),
  esResponsableVenta: z.boolean().optional(),
})

export const cambiarPasswordSchema = z.object({
  password: z.string().min(1, 'La contraseña es requerida'),
  passwordConfirm: z.string().min(1, 'Confirma la contraseña'),
})

export const usuarioIdParamSchema = z.object({
  id: z.string().min(1),
})

export const usuarioListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(500).default(20),
  q: z.string().optional(),
  perfilId: z.coerce.number().int().positive().optional(),
  esResponsableVenta: z
    .string()
    .optional()
    .transform((v) => {
      if (v === undefined) return undefined
      return v === 'true' ? true : v === 'false' ? false : undefined
    }),
})

export type UsuarioCreateInput = z.infer<typeof usuarioCreateSchema>
export type UsuarioUpdateInput = z.infer<typeof usuarioUpdateSchema>
export type CambiarPasswordInput = z.infer<typeof cambiarPasswordSchema>
export type UsuarioListQuery = z.infer<typeof usuarioListQuerySchema>
