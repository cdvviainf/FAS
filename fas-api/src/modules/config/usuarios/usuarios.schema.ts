import { z } from 'zod'

export const usuarioCreateSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido').max(200).trim(),
  email: z.string().email('Email inválido').max(200).toLowerCase().trim(),
  whatsapp: z.string().max(50).trim().optional(),
  perfilId: z.number().int().positive('El perfil es requerido'),
  esResponsableVenta: z.boolean().default(false),
  password: z.string().min(1, 'La contraseña es requerida'),
  passwordConfirm: z.string().min(1, 'Confirma la contraseña'),
  // Multi-empresa (Fase 4b): empresas a las que se asigna el usuario y cuál
  // es su predeterminada al iniciar sesión. Invariante §2 de empresas.md:
  // la predeterminada debe estar entre las empresas asignadas.
  empresas: z.array(z.number().int().positive()).default([])
    .refine((ids) => new Set(ids).size === ids.length, { message: 'Hay empresas repetidas en la asignación' }),
  empresaPredeterminadaId: z.number().int().positive().nullable().optional(),
}).refine(
  (data) => data.empresaPredeterminadaId == null || data.empresas.includes(data.empresaPredeterminadaId),
  { message: 'La empresa predeterminada debe estar entre las empresas asignadas', path: ['empresaPredeterminadaId'] },
)

export const usuarioUpdateSchema = z.object({
  nombre: z.string().min(1).max(200).trim().optional(),
  whatsapp: z.string().max(50).trim().optional().nullable(),
  perfilId: z.number().int().positive().optional(),
  esResponsableVenta: z.boolean().optional(),
  // Si `empresas` no viene, las membresías actuales no se tocan. Si viene,
  // reemplaza el set completo. La consistencia final con `empresaPredeterminadaId`
  // (incluido el caso donde no se toca ninguno de los dos) se resuelve en el
  // servicio, que sí conoce el estado actual del usuario.
  empresas: z.array(z.number().int().positive())
    .refine((ids) => new Set(ids).size === ids.length, { message: 'Hay empresas repetidas en la asignación' })
    .optional(),
  empresaPredeterminadaId: z.number().int().positive().nullable().optional(),
}).refine(
  (data) => data.empresas === undefined || data.empresaPredeterminadaId == null || data.empresas.includes(data.empresaPredeterminadaId),
  { message: 'La empresa predeterminada debe estar entre las empresas asignadas', path: ['empresaPredeterminadaId'] },
)

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
