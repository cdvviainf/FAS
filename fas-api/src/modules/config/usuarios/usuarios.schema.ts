import { z } from 'zod'

export const usuarioCreateSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido').max(200).trim(),
  email: z.string().email('Email inválido').max(200).toLowerCase().trim(),
  whatsapp: z.string().max(50).trim().optional(),
  imagenUrl: z.string().url('URL de imagen inválida').max(500).optional().or(z.literal('')),
  perfilId: z.number().int().positive('El perfil es requerido'),
  password: z.string().min(1, 'La contraseña es requerida'),
  passwordConfirm: z.string().min(1, 'Confirma la contraseña'),
})

export const usuarioUpdateSchema = z.object({
  nombre: z.string().min(1).max(200).trim().optional(),
  whatsapp: z.string().max(50).trim().optional().nullable(),
  imagenUrl: z.string().url().max(500).optional().nullable().or(z.literal('')),
  perfilId: z.number().int().positive().optional(),
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
  limit: z.coerce.number().int().positive().max(100).default(20),
  q: z.string().optional(),
  perfilId: z.coerce.number().int().positive().optional(),
})

export type UsuarioCreateInput = z.infer<typeof usuarioCreateSchema>
export type UsuarioUpdateInput = z.infer<typeof usuarioUpdateSchema>
export type CambiarPasswordInput = z.infer<typeof cambiarPasswordSchema>
export type UsuarioListQuery = z.infer<typeof usuarioListQuerySchema>
