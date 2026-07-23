import { z } from 'zod'

export const asignadoSchema = z.object({
  usuarioId: z.string().min(1),
  funcion: z.enum(['ACUDIR', 'NOTIFICAR']),
})

export const solicitudCreateSchema = z.object({
  temporadaId: z.number().int().positive('La temporada es requerida'),
  entidadProductorId: z.number().int().positive('El productor es requerido'),
  direccionId: z.number().int().positive('La dirección es requerida'),
  contactoId: z.number().int().positive().nullable().optional(),
  especieId: z.number().int().positive().nullable().optional(),
  fechaHora: z.string().datetime({ offset: true, message: 'Fecha/hora inválida (ISO 8601)' }),
  motivoId: z.number().int().positive('El motivo es requerido'),
  observaciones: z.string().max(5000).nullable().optional(),
  asignados: z
    .array(asignadoSchema)
    .min(1, 'Debe asignar al menos un usuario')
    .refine((a) => a.some((x) => x.funcion === 'ACUDIR'), {
      message: 'Debe haber al menos un asignado con función Acudir',
    })
    .refine((a) => new Set(a.map((x) => x.usuarioId)).size === a.length, {
      message: 'Hay usuarios repetidos en los asignados',
    }),
})

// La temporada no se cambia después de creada (el correlativo depende de ella)
export const solicitudUpdateSchema = solicitudCreateSchema.omit({ temporadaId: true }).partial()

export const solicitudParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
})

export const adjuntoParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
  adjuntoId: z.coerce.number().int().positive(),
})

export const solicitudListQuerySchema = z.object({
  q: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(20),
  estado: z.enum(['PENDIENTE', 'NOTIFICADA', 'CERRADA']).optional(),
  temporadaId: z.coerce.number().int().positive().optional(),
  entidadProductorId: z.coerce.number().int().positive().optional(),
  usuarioAsignadoId: z.string().optional(),
  fechaDesde: z.string().date().optional(),
  fechaHasta: z.string().date().optional(),
})

export const solicitudCerrarSchema = z.object({
  comentarios: z.string().min(1, 'Los comentarios de cierre son requeridos').max(5000),
})

export type SolicitudCreateBody = z.infer<typeof solicitudCreateSchema>
export type SolicitudUpdateBody = z.infer<typeof solicitudUpdateSchema>
export type SolicitudCerrarBody = z.infer<typeof solicitudCerrarSchema>
