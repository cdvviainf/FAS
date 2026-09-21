import { z } from 'zod'

const TIPO_ENTIDAD_VALUES = [
  'CLIENTE_NACIONAL', 'CLIENTE_EXTRANJERO', 'NOTIFY', 'CONSIGNATARIO', 'NAVIERA',
  'AGENTE_ADUANA', 'COMPANIA_EMBARQUE', 'PROVEEDOR', 'EMPRESA_TRANSPORTE',
  'PRODUCTOR', 'EXPORTADORA', 'PLANTA',
] as const

export const tipoMovimientoCreateSchema = z.object({
  codigo: z.string().min(1, 'El código es requerido').max(50).trim(),
  descripcion: z.string().min(1, 'La descripción es requerida').max(200).trim(),
  modulos: z.array(z.enum(['MATERIALES', 'FRUTA'])).min(1, 'Debe seleccionar al menos un módulo'),
  clase: z.enum(['ENTRADA', 'SALIDA', 'TRASLADO']),
  requierePrecio: z.boolean().default(false),
  entidadRelacionada: z.enum(TIPO_ENTIDAD_VALUES).optional().nullable(),
  emiteDTE: z.boolean().default(false),
  // Motivo de traslado SII (catálogo IndTraslado) — requerido solo si
  // emiteDTE=true, validado en tipos-movimiento.service.ts (no acá: el
  // default de emiteDTE es false y Zod no puede referirse a otro campo
  // opcional de forma legible con .default() encadenado).
  indTrasladoSii: z.number().int().min(1).max(9).optional().nullable(),
  generaProforma: z.boolean().default(false),
  activo: z.boolean().default(true),
})

export const tipoMovimientoUpdateSchema = tipoMovimientoCreateSchema.omit({ codigo: true }).partial()

export const tipoMovimientoParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
})

export const tipoMovimientoListQuerySchema = z.object({
  modulo: z.enum(['MATERIALES', 'FRUTA']).optional(),
  clase: z.enum(['ENTRADA', 'SALIDA', 'TRASLADO']).optional(),
  activo: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(20),
})

export type TipoMovimientoCreateBody = z.infer<typeof tipoMovimientoCreateSchema>
export type TipoMovimientoUpdateBody = z.infer<typeof tipoMovimientoUpdateSchema>
