import { z } from 'zod'

export const correoConfigBodySchema = z.object({
  host: z.string().min(1, 'Host requerido').max(255),
  puerto: z.number().int().min(1).max(65535),
  seguridad: z.enum(['STARTTLS', 'SSL', 'NINGUNA']),
  usuario: z.string().min(1, 'Usuario requerido').max(255),
  // Opcional en update: si no viene, se conserva la password guardada
  password: z.string().min(1).max(255).optional(),
  remitenteNombre: z.string().min(1, 'Nombre remitente requerido').max(255),
  remitenteEmail: z.string().email('Email remitente inválido').max(255),
})

export const correoProbarBodySchema = z.object({
  destinatario: z.string().email('Email destinatario inválido'),
})

export type CorreoConfigBody = z.infer<typeof correoConfigBodySchema>
export type CorreoProbarBody = z.infer<typeof correoProbarBodySchema>
