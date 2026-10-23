import { z } from 'zod'
import { parCalidadSchema } from '../../../shared/calidades-permitidas.js'

export const asignadoSchema = z.object({
  usuarioId: z.string().min(1),
  funcion: z.enum(['ACUDIR', 'NOTIFICAR']),
})

export const solicitudCreateSchema = z.object({
  temporadaId: z.number().int().positive('La temporada es requerida'),
  // Opcional: si se omite, el service lo defaultea al usuario autenticado
  // (ver crearSolicitud) — igual que hace la UI, pero también para
  // cualquier otro consumidor de la API (QA-R2-SI-001).
  usuarioSolicitanteId: z.string().min(1).optional(),
  entidadProductorId: z.number().int().positive('El productor es requerido'),
  // Planta (Entidad tipo PLANTA, opcional). La UI la autocompleta si el productor
  // también es planta, pero es editable.
  plantaId: z.number().int().positive().nullable().optional(),
  direccionId: z.number().int().positive('La dirección es requerida'),
  contactoId: z.number().int().positive().nullable().optional(),
  especieId: z.number().int().positive().nullable().optional(),
  // Fecha/hora de la VISITA (2026-10-13): ya NO se ingresa al crear — se fija
  // al editar la visita o en el cierre. Opcional/nullable acá.
  fechaHora: z.string().datetime({ offset: true, message: 'Fecha/hora inválida (ISO 8601)' }).nullable().optional(),
  mercadoId: z.number().int().positive().nullable().optional(),
  paisIds: z.array(z.number().int().positive()).optional(),
  clienteId: z.number().int().positive().nullable().optional(),
  fechaDespacho: z.string().date().nullable().optional(),
  cantidadPallets: z.number().int().positive().nullable().optional(),
  // Calidades permitidas = pares (NotaCalidad, NotaCondicion) — supersede las dos
  // listas independientes (producto cartesiano). Combinaciones específicas.
  calidadesPermitidas: z.array(parCalidadSchema).optional(),
  variedadIds: z.array(z.number().int().positive()).optional(),
  calibreIds: z.array(z.number().int().positive()).optional(),
  categoriaIds: z.array(z.number().int().positive()).optional(),
  articuloIds: z.array(z.number().int().positive()).optional(),
  observaciones: z.string().max(5000).nullable().optional(),
  // 2026-10-05: ya no se exige un asignado con función ACUDIR — basta con al
  // menos un asignado (puede ser solo NOTIFICAR). El refine de ACUDIR obligatorio
  // fue retirado por decisión de negocio.
  asignados: z
    .array(asignadoSchema)
    .min(1, 'Debe asignar al menos un usuario')
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
  estado: z.enum(['PENDIENTE', 'NOTIFICADA', 'APROBADA', 'RECHAZADA', 'OBJETADA']).optional(),
  temporadaId: z.coerce.number().int().positive().optional(),
  entidadProductorId: z.coerce.number().int().positive().optional(),
  usuarioAsignadoId: z.string().optional(),
  fechaDesde: z.string().date().optional(),
  fechaHasta: z.string().date().optional(),
})

// Línea de defecto del cierre (2026-10-13): grupo + defecto + valor. El rango
// del valor (entero si UNIDADES, 0..100 si PORCENTAJE) se valida en el service
// contra Defecto.tipoMedida — acá solo se exige ≥ 0.
export const solicitudDefectoSchema = z.object({
  grupoDefectoId: z.number().int().positive(),
  defectoId: z.number().int().positive(),
  // Máximo acorde a la columna Decimal(7,2) (99999.99). El tope 0..100 para
  // PORCENTAJE y el entero para UNIDADES se validan en el service por tipoMedida.
  valor: z.number().min(0, 'El valor no puede ser negativo').max(99999.99, 'El valor es demasiado grande'),
})

export const solicitudCerrarSchema = z.object({
  comentarios: z.string().min(1, 'Los comentarios de cierre son requeridos').max(5000),
  // OBJETADA (2026-08-10): tercer veredicto de cierre, terminal — mismo
  // tratamiento que RECHAZADA (bloquea OC, no se reabre automáticamente).
  resultado: z.enum(['APROBADA', 'RECHAZADA', 'OBJETADA'], { message: 'El resultado (Aprobado/Rechazado/Objetado) es requerido' }),
  // Fecha/hora de la visita (2026-10-13): se ingresa/edita en el cierre. Puede
  // omitirse si la solicitud ya la tenía fijada; el service exige una fecha
  // efectiva (body o la vigente) y rechaza null.
  fechaHora: z.string().datetime({ offset: true, message: 'Fecha/hora inválida (ISO 8601)' }).nullable().optional(),
  // Asignados (incluye a quién asiste = ACUDIR): REEMPLAZA el set y es obligatorio
  // en el cierre — debe registrar quién asistió (el service exige ≥1 ACUDIR).
  asignados: z
    .array(asignadoSchema)
    .min(1, 'Debe registrar al menos una persona que asiste')
    .refine((a) => new Set(a.map((x) => x.usuarioId)).size === a.length, { message: 'Hay usuarios repetidos en los asignados' }),
  // Defectos registrados en la visita: grupo+defecto no se repiten.
  defectos: z
    .array(solicitudDefectoSchema)
    .refine((ds) => new Set(ds.map((d) => `${d.grupoDefectoId}-${d.defectoId}`)).size === ds.length, {
      message: 'Hay defectos repetidos (mismo grupo y defecto)',
    })
    .optional(),
})

export type SolicitudCreateBody = z.infer<typeof solicitudCreateSchema>
export type SolicitudUpdateBody = z.infer<typeof solicitudUpdateSchema>
export type SolicitudCerrarBody = z.infer<typeof solicitudCerrarSchema>
