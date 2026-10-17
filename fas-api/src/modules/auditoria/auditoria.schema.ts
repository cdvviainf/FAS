import { z } from 'zod'

export const registrarNavegacionSchema = z.object({
  ruta: z.string().min(1).max(300),
  itemMenuCodigo: z.string().max(100).optional().nullable(),
})

export const auditoriaListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  usuarioId: z.string().max(100).optional(),
  accion: z.enum(['LOGIN', 'LOGOUT', 'LOGIN_FALLIDO', 'ACCESO_MENU', 'CREAR', 'EDITAR', 'ELIMINAR']).optional(),
  entidad: z.string().max(100).optional(),
  desde: z.string().datetime().or(z.string().date()).optional(),
  hasta: z.string().datetime().or(z.string().date()).optional(),
  q: z.string().max(200).optional(),
})
