import { z } from 'zod'
import { TipoEntidad } from '@prisma/client'

// ─── Enum values ──────────────────────────────────────────────────────────────

const tipoEntidadValues = Object.values(TipoEntidad) as [TipoEntidad, ...TipoEntidad[]]

// ─── Entidad ──────────────────────────────────────────────────────────────────

export const entidadCreateSchema = z.object({
  codigo: z.string().min(1, 'El código es requerido').max(50).trim(),
  descripcion: z.string().min(1, 'La descripción es requerida').max(200).trim(),
  descripcionExtranjera: z.string().max(200).trim().optional(),
  razonSocial: z.string().min(1, 'La razón social es requerida').max(200).trim(),
  giro: z.string().max(200).trim().optional(),
  identificador: z.string().max(20).trim().optional(),
  paisId: z.number().int().positive('El país es requerido'),
  email: z.string().email('Email inválido').max(200).trim().optional(),
  telefono: z.string().max(50).trim().optional(),
  codigoExterno: z.string().max(50).trim().optional(),
  activo: z.boolean().default(true),
  tipos: z.array(z.enum(tipoEntidadValues)).min(1, 'Debe tener al menos un tipo'),
})

export const entidadUpdateSchema = z.object({
  codigo: z.string().min(1).max(50).trim().optional(),
  descripcion: z.string().min(1).max(200).trim().optional(),
  descripcionExtranjera: z.string().max(200).trim().nullable().optional(),
  razonSocial: z.string().min(1).max(200).trim().optional(),
  giro: z.string().max(200).trim().nullable().optional(),
  identificador: z.string().max(20).trim().nullable().optional(),
  paisId: z.number().int().positive().optional(),
  email: z.string().email('Email inválido').max(200).trim().nullable().optional(),
  telefono: z.string().max(50).trim().nullable().optional(),
  codigoExterno: z.string().max(50).trim().nullable().optional(),
  activo: z.boolean().optional(),
  tipos: z.array(z.enum(tipoEntidadValues)).min(1).optional(),
})

// ─── Dirección ────────────────────────────────────────────────────────────────

export const direccionCreateSchema = z.object({
  codigo: z.string().min(1, 'El código es requerido').max(50).trim(),
  paisId: z.number().int().positive('El país es requerido'),
  comunaId: z.number().int().positive().optional(),
  direccion: z.string().min(1, 'La dirección es requerida').max(300).trim(),
  esPorDefecto: z.boolean().default(false),
  latitud: z.number().min(-90).max(90).nullable().optional(),
  longitud: z.number().min(-180).max(180).nullable().optional(),
})

export const direccionUpdateSchema = z.object({
  codigo: z.string().min(1).max(50).trim().optional(),
  paisId: z.number().int().positive().optional(),
  comunaId: z.number().int().positive().nullable().optional(),
  direccion: z.string().min(1).max(300).trim().optional(),
  esPorDefecto: z.boolean().optional(),
  latitud: z.number().min(-90).max(90).nullable().optional(),
  longitud: z.number().min(-180).max(180).nullable().optional(),
})

// ─── Contacto ─────────────────────────────────────────────────────────────────

export const contactoCreateSchema = z.object({
  codigo: z.string().min(1, 'El código es requerido').max(50).trim(),
  nombre: z.string().min(1, 'El nombre es requerido').max(200).trim(),
  rut: z.string().max(20).trim().optional(),
  whatsapp: z.string().max(50).trim().optional(),
  email: z.string().email('Email inválido').max(200).trim().optional(),
  telefono: z.string().max(50).trim().optional(),
  tipo: z.string().max(100).trim().optional(),
  esRepresentanteLegal: z.boolean().default(false),
})

export const contactoUpdateSchema = z.object({
  codigo: z.string().min(1).max(50).trim().optional(),
  nombre: z.string().min(1).max(200).trim().optional(),
  rut: z.string().max(20).trim().nullable().optional(),
  whatsapp: z.string().max(50).trim().nullable().optional(),
  email: z.string().email('Email inválido').max(200).trim().nullable().optional(),
  telefono: z.string().max(50).trim().nullable().optional(),
  tipo: z.string().max(100).trim().nullable().optional(),
  esRepresentanteLegal: z.boolean().optional(),
})

// ─── Params y Query ───────────────────────────────────────────────────────────

export const entidadIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
})

export const entidadDireccionParamSchema = z.object({
  id: z.coerce.number().int().positive(),
  dirId: z.coerce.number().int().positive(),
})

export const entidadContactoParamSchema = z.object({
  id: z.coerce.number().int().positive(),
  conId: z.coerce.number().int().positive(),
})

export const entidadListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  q: z.string().trim().optional(),
  tipo: z.enum(tipoEntidadValues).optional(),
  activo: z
    .string()
    .optional()
    .transform((v) => {
      if (v === undefined) return undefined
      return v === 'true' ? true : v === 'false' ? false : undefined
    }),
})

// ─── Tipos inferidos ──────────────────────────────────────────────────────────

export type EntidadCreateInput = z.infer<typeof entidadCreateSchema>
export type EntidadUpdateInput = z.infer<typeof entidadUpdateSchema>
export type DireccionCreateInput = z.infer<typeof direccionCreateSchema>
export type DireccionUpdateInput = z.infer<typeof direccionUpdateSchema>
export type ContactoCreateInput = z.infer<typeof contactoCreateSchema>
export type ContactoUpdateInput = z.infer<typeof contactoUpdateSchema>
export type EntidadListQuery = z.infer<typeof entidadListQuerySchema>
