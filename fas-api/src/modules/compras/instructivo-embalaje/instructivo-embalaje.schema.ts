import { z } from 'zod'

const instructivoEmbalajeDetalleSchema = z.object({
  articuloId: z.number().int().positive('El artículo de embalaje es requerido'),
  especieId: z.number().int().positive('La especie es requerida'),
  variedadId: z.number().int().positive('La variedad es requerida'),
  variedadRotuladaId: z.number().int().positive().optional().nullable(),
  categoriaId: z.number().int().positive('La categoría es requerida'),
  calibreIds: z.array(z.number().int().positive()).min(1, 'Selecciona al menos un calibre'),
  tipoPalletId: z.number().int().positive().optional().nullable(),
  alturaId: z.number().int().positive('La altura de pallet es requerida'),
  cantidadPallets: z.number().int().positive('La cantidad de pallets debe ser mayor a 0'),
  cajasPorPallet: z.number().int().positive('Las cajas por pallet deben ser mayor a 0'),
  cajas: z.number().int().positive('Las cajas deben ser mayor a 0'),
})

export const instructivoEmbalajeCreateSchema = z.object({
  entidadProductorId: z.number().int().positive('El productor es requerido'),
  grupoMercadoId: z.number().int().positive('El grupo de mercado es requerido'),
  fechaInicioPrograma: z.coerce.date({ message: 'La fecha de inicio de programa es requerida' }),
  observaciones: z.string().max(5000).trim().optional().nullable(),
  detalle: z.array(instructivoEmbalajeDetalleSchema).min(1, 'El instructivo debe tener al menos una línea'),
})

// El Instructivo no tiene estado propio (compras.md §4.1) — a diferencia de
// la OC no hay transición que lo bloquee, así que el PATCH acepta reemplazar
// el encabezado y/o el detalle completo en cualquier momento. Debe traer al
// menos un campo: un body vacío no representa ningún cambio.
export const instructivoEmbalajeUpdateSchema = z
  .object({
    entidadProductorId: z.number().int().positive('El productor es requerido').optional(),
    grupoMercadoId: z.number().int().positive('El grupo de mercado es requerido').optional(),
    fechaInicioPrograma: z.coerce.date().optional(),
    observaciones: z.string().max(5000).trim().optional().nullable(),
    detalle: z.array(instructivoEmbalajeDetalleSchema).min(1, 'El instructivo debe tener al menos una línea').optional(),
  })
  .refine(
    (data) =>
      data.entidadProductorId !== undefined ||
      data.grupoMercadoId !== undefined ||
      data.fechaInicioPrograma !== undefined ||
      data.observaciones !== undefined ||
      data.detalle !== undefined,
    { message: 'Debe incluir al menos un campo a actualizar' },
  )

export const instructivoEmbalajeParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
})

export const instructivoEmbalajeListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  entidadProductorId: z.coerce.number().int().positive().optional(),
  estadoInspeccion: z.enum(['PENDIENTE', 'NOTIFICADA', 'APROBADA', 'RECHAZADA', 'CERRADA']).optional(),
})

// ─── Inspección de Proceso (2026-08-21) — el Instructivo es la inspección ───
// que gestiona Calidad. Veredicto de aprobación/rechazo con comentario
// obligatorio en ambos casos (calidad.md §4, QA ronda 2 FAS-INSP-1A-R2-002).
// .trim() va ANTES de .min(1): Zod valida en el orden declarado, así que
// hacerlo al revés deja pasar cadenas "solo espacios" (min(1) las acepta,
// trim() las vacía después) — QA ronda 3, FAS-INSP-1A-R2-002.
export const inspeccionAprobarSchema = z.object({
  comentario: z.string().trim().min(1, 'El comentario de la aprobación es requerido').max(5000),
})

export const inspeccionRechazarSchema = z.object({
  comentario: z.string().trim().min(1, 'El comentario del rechazo es requerido').max(5000),
})

// Carga masiva de folios (números de pallet). El frontend parte el textarea en
// líneas; aquí llega ya como arreglo. Se normaliza (trim) y valida no-vacío.
export const foliosCreateSchema = z.object({
  folios: z
    .array(z.string().trim().min(1, 'El folio no puede estar vacío'))
    .min(1, 'Debe indicar al menos un folio'),
})

export const folioParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
  folioId: z.coerce.number().int().positive(),
})

export type InstructivoEmbalajeCreateBody = z.infer<typeof instructivoEmbalajeCreateSchema>
export type InstructivoEmbalajeUpdateBody = z.infer<typeof instructivoEmbalajeUpdateSchema>
export type InspeccionAprobarBody = z.infer<typeof inspeccionAprobarSchema>
export type InspeccionRechazarBody = z.infer<typeof inspeccionRechazarSchema>
export type FoliosCreateBody = z.infer<typeof foliosCreateSchema>
