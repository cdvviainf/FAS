import { z } from 'zod'

const nivelAccesoValues = ['SIN_ACCESO', 'LECTURA', 'TOTAL'] as const

export const accesoInputSchema = z.object({
  itemMenuId: z.number().int().positive(),
  nivel: z.enum(nivelAccesoValues),
})

export const perfilCreateSchema = z.object({
  codigo: z.string().min(1, 'El código es requerido').max(50).trim(),
  descripcion: z.string().min(1, 'La descripción es requerida').max(200).trim(),
  accesos: z.array(accesoInputSchema).optional().default([]),
})

export const perfilUpdateSchema = z.object({
  codigo: z.string().min(1).max(50).trim().optional(),
  descripcion: z.string().min(1).max(200).trim().optional(),
  accesos: z.array(accesoInputSchema).optional(),
})

export const perfilIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
})

export const perfilListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  q: z.string().optional(),
})

export type PerfilCreateInput = z.infer<typeof perfilCreateSchema>
export type PerfilUpdateInput = z.infer<typeof perfilUpdateSchema>
export type PerfilListQuery = z.infer<typeof perfilListQuerySchema>
