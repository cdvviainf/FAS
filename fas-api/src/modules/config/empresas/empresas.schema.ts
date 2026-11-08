import { z } from 'zod'

// ─── Dirección ────────────────────────────────────────────────────────────────

export const direccionCreateSchema = z.object({
  codigo: z.string().min(1, 'El código es requerido').max(50).trim(),
  descripcion: z.string().min(1, 'La descripción es requerida').max(200).trim(),
  paisId: z.number().int().positive('El país es requerido'),
  comunaId: z.number().int().positive().optional(),
  direccion: z.string().min(1, 'La dirección es requerida').max(300).trim(),
  esPorDefecto: z.boolean().default(false),
  latitud: z.number().min(-90).max(90).nullable().optional(),
  longitud: z.number().min(-180).max(180).nullable().optional(),
})

export const direccionUpdateSchema = z.object({
  codigo: z.string().min(1).max(50).trim().optional(),
  descripcion: z.string().min(1).max(200).trim().optional(),
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

// ─── Empresa ──────────────────────────────────────────────────────────────────

export const empresaCreateSchema = z.object({
  codigo: z.string().min(1, 'El código es requerido').max(50).trim(),
  razonSocial: z.string().min(1, 'La razón social es requerida').max(200).trim(),
  nombreFantasia: z.string().max(200).trim().optional(),
  rut: z.string().max(20).trim().optional(),
  giro: z.string().max(200).trim().optional(),
  email: z.string().email('Email inválido').max(200).trim().optional(),
  telefono: z.string().max(50).trim().optional(),
  activo: z.boolean().default(true),
  // Sub-recursos opcionales: permiten crear la empresa junto con sus
  // direcciones/contactos iniciales en una única transacción de backend
  // (evita dejar el código "quemado" por un rollback parcial vía soft-delete).
  direcciones: z.array(direccionCreateSchema).max(50).default([]),
  contactos: z.array(contactoCreateSchema).max(50).default([]),
})

export const empresaUpdateSchema = z.object({
  codigo: z.string().min(1).max(50).trim().optional(),
  razonSocial: z.string().min(1).max(200).trim().optional(),
  nombreFantasia: z.string().max(200).trim().nullable().optional(),
  rut: z.string().max(20).trim().nullable().optional(),
  giro: z.string().max(200).trim().nullable().optional(),
  email: z.string().email('Email inválido').max(200).trim().nullable().optional(),
  telefono: z.string().max(50).trim().nullable().optional(),
  activo: z.boolean().optional(),
})

// ─── Params y Query ───────────────────────────────────────────────────────────

export const empresaIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
})

export const empresaDireccionParamSchema = z.object({
  id: z.coerce.number().int().positive(),
  dirId: z.coerce.number().int().positive(),
})

export const empresaContactoParamSchema = z.object({
  id: z.coerce.number().int().positive(),
  conId: z.coerce.number().int().positive(),
})

export const empresaListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(500).default(20),
  q: z.string().trim().optional(),
  activo: z
    .string()
    .optional()
    .transform((v) => {
      if (v === undefined) return undefined
      return v === 'true' ? true : v === 'false' ? false : undefined
    }),
})

// ─── Tipos inferidos ──────────────────────────────────────────────────────────

// ─── Términos de la Orden de Compra (2026-11-06, PDF OC v3) ───────────────────
// Reemplazo completo (replace-all): nota final ES/EN + cláusulas en orden.
export const ICONOS_CLAUSULA = ['CALIDAD', 'INOCUIDAD', 'COSTOS', 'TRIBUTARIO', 'EMBARQUE', 'ACEPTACION', 'DOCUMENTO', 'INFO'] as const
export const clausulaOcSchema = z.object({
  icono: z.enum(ICONOS_CLAUSULA),
  tituloEs: z.string().min(1, 'El título en español es requerido').max(200).trim(),
  textoEs: z.string().min(1, 'El texto en español es requerido').max(3000).trim(),
  tituloEn: z.string().min(1, 'El título en inglés es requerido').max(200).trim(),
  textoEn: z.string().min(1, 'El texto en inglés es requerido').max(3000).trim(),
})
export const terminosOcSchema = z.object({
  notaEs: z.string().max(2000).trim().nullable().optional(),
  notaEn: z.string().max(2000).trim().nullable().optional(),
  clausulas: z.array(clausulaOcSchema).max(20, 'Máximo 20 cláusulas'),
  // Recuadro "Reclamos" del PDF de Cierre Comercial v2 (2026-11-06). Opcional:
  // si no viene, no se toca lo guardado.
  reclamosCierre: z.object({
    textoEs: z.string().max(3000).trim().nullable().optional(),
    textoEn: z.string().max(3000).trim().nullable().optional(),
    refEs: z.string().max(300).trim().nullable().optional(),
    refEn: z.string().max(300).trim().nullable().optional(),
  }).optional(),
})

export type EmpresaCreateInput = z.infer<typeof empresaCreateSchema>
export type EmpresaUpdateInput = z.infer<typeof empresaUpdateSchema>
export type DireccionCreateInput = z.infer<typeof direccionCreateSchema>
export type DireccionUpdateInput = z.infer<typeof direccionUpdateSchema>
export type ContactoCreateInput = z.infer<typeof contactoCreateSchema>
export type ContactoUpdateInput = z.infer<typeof contactoUpdateSchema>
export type EmpresaListQuery = z.infer<typeof empresaListQuerySchema>
export type TerminosOcInput = z.infer<typeof terminosOcSchema>
