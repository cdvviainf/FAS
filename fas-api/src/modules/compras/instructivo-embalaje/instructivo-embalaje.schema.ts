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
})

export type InstructivoEmbalajeCreateBody = z.infer<typeof instructivoEmbalajeCreateSchema>
export type InstructivoEmbalajeUpdateBody = z.infer<typeof instructivoEmbalajeUpdateSchema>
