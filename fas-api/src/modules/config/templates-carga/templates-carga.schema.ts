import { z } from 'zod'
import { CAMPOS_TEMPLATE_CARGA } from './templates-carga.types.js'

const campoSchema = z.object({
  campo: z.enum(CAMPOS_TEMPLATE_CARGA),
  columna: z.string().min(1, 'La columna es requerida').max(100).trim(),
})

// Validación estructural básica (tipos, formatos por campo). La coherencia
// cruzada (tieneCabecera vs filaCabecera/filaPrimerRegistro, completitud de
// campos, formato de columna sin cabecera) se valida en el service sobre el
// objeto efectivo ya fusionado con lo persistido — un PATCH parcial no puede
// evaluarse de forma aislada sin conocer el resto del registro (QAR-RCT-003).
export const templateCargaCreateSchema = z.object({
  codigo: z.string().min(1, 'El código es requerido').max(50).trim(),
  descripcion: z.string().min(1, 'La descripción es requerida').max(200).trim(),
  tieneCabecera: z.boolean().default(true),
  filaCabecera: z.number().int().positive().optional().nullable(),
  filaPrimerRegistro: z.number().int().positive('La fila del primer registro es requerida'),
  campos: z.array(campoSchema).min(1, 'Debe mapear al menos un campo'),
})

export const templateCargaUpdateSchema = z.object({
  descripcion: z.string().min(1).max(200).trim().optional(),
  tieneCabecera: z.boolean().optional(),
  filaCabecera: z.number().int().positive().optional().nullable(),
  filaPrimerRegistro: z.number().int().positive().optional(),
  bloqueado: z.boolean().optional(),
  campos: z.array(campoSchema).min(1, 'Debe mapear al menos un campo').optional(),
})

export const templateCargaParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
})

export const templateCargaListQuerySchema = z.object({
  q: z.string().trim().optional(),
})

export type TemplateCargaCreateBody = z.infer<typeof templateCargaCreateSchema>
export type TemplateCargaUpdateBody = z.infer<typeof templateCargaUpdateSchema>
