import { z } from 'zod'

export const mantenedorListQuerySchema = z.object({
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(20),
  // Orden server-side: JSON [{ id, desc }] (formato de TanStack/getSortingStateParser).
  sort: z.string().optional(),
  // FK filters (optional)
  regionId: z.coerce.number().int().positive().optional(),
  provinciaId: z.coerce.number().int().positive().optional(),
  comunaId: z.coerce.number().int().positive().optional(),
  especieId: z.coerce.number().int().positive().optional(),
  grupoVariedadId: z.coerce.number().int().positive().optional(),
  tipoParametroId: z.coerce.number().int().positive().optional(),
  grupoMercadoId: z.coerce.number().int().positive().optional(),
  paisId: z.coerce.number().int().positive().optional(),
  mercadoId: z.coerce.number().int().positive().optional(),
  tipoEmbarqueId: z.coerce.number().int().positive().optional(),
  grupoDefectoId: z.coerce.number().int().positive().optional(),
  contexto: z.enum(['origen', 'destino']).optional(),
  // z.coerce.boolean() convertiría "false" (string) a true; enum explícito lo evita
  soloActivos: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
})

export const mantenedorParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
})

export const mantenedorBaseSchema = z.object({
  codigo: z.string().min(1).max(50).trim(),
  descripcion: z.string().min(1).max(200).trim(),
  descripcionExtranjera: z.string().max(200).trim().optional(),
  // Código de la tabla de Aduana del SII para el DTE 110 de exportación. Solo
  // aplica a ClausulaVenta, TipoEmbarque (vía), Puerto, Pais y el Parámetro de
  // Modalidad de Venta; el resto de mantenedores simplemente no lo usan.
  codigoAduana: z.string().max(20).trim().optional().nullable(),
})

export const mantenedorUpdateSchema = mantenedorBaseSchema
  .omit({ codigo: true })
  .partial()

// ─── Pais ───────────────────────────────────────────────────────────────────

export const paisBodySchema = mantenedorBaseSchema.extend({
  codigo: z
    .string()
    .length(3, 'El código de país debe ser ISO alfa-3 (3 letras)')
    .regex(/^[A-Z]{3}$/, 'El código debe ser 3 letras mayúsculas (ej: CHL, USA)')
    .trim(),
  esPaisNacional: z.boolean().default(false),
  puedeSerOrigen: z.boolean().default(false),
  // N:M (2026-10-05, supersede mercadoId singular): un país puede mapear a
  // varios mercados por empresa — así distintos grupos de mercado pueden
  // compartir el mismo país.
  mercadoIds: z.array(z.number().int().positive()).min(1, 'Selecciona al menos un mercado'),
})

export const paisUpdateSchema = paisBodySchema.omit({ codigo: true }).partial()

// ─── Provincia ──────────────────────────────────────────────────────────────

export const provinciaBodySchema = mantenedorBaseSchema.extend({
  regionId: z.number().int().positive({ message: 'Selecciona una región' }),
})

export const provinciaUpdateSchema = provinciaBodySchema
  .omit({ codigo: true })
  .partial()

// ─── Comuna ─────────────────────────────────────────────────────────────────

export const comunaBodySchema = mantenedorBaseSchema.extend({
  provinciaId: z.number().int().positive({ message: 'Selecciona una provincia' }),
})

export const comunaUpdateSchema = comunaBodySchema
  .omit({ codigo: true })
  .partial()

// ─── GrupoVariedad ──────────────────────────────────────────────────────────

export const grupoVariedadBodySchema = mantenedorBaseSchema.extend({
  especieId: z.number().int().positive({ message: 'Selecciona una especie' }),
})

export const grupoVariedadUpdateSchema = grupoVariedadBodySchema
  .omit({ codigo: true })
  .partial()

// ─── Variedad ───────────────────────────────────────────────────────────────

export const variedadBodySchema = mantenedorBaseSchema.extend({
  especieId: z.number().int().positive({ message: 'Selecciona una especie' }),
  grupoVariedadId: z.number().int().positive({ message: 'Selecciona un grupo de variedad' }),
})

export const variedadUpdateSchema = variedadBodySchema
  .omit({ codigo: true })
  .partial()

// ─── Defecto (catálogo de defectos, 2026-10-06) ──────────────────────────────
// GrupoDefecto es mantenedor plano (usa el schema base, sin schemaKey).

export const defectoBodySchema = mantenedorBaseSchema.extend({
  grupoDefectoId: z.number().int().positive({ message: 'Selecciona un grupo de defecto' }),
  // Validez por especie (opcional, N:M). Sin especies = defecto genérico.
  especieIds: z.array(z.number().int().positive()).optional(),
})

export const defectoUpdateSchema = defectoBodySchema.omit({ codigo: true }).partial()

// ─── Especie ─────────────────────────────────────────────────────────────────

export const especieBodySchema = mantenedorBaseSchema.extend({
  unidadMedidaCalidadId: z.number().int().positive().optional().nullable(),
})

export const especieUpdateSchema = especieBodySchema
  .omit({ codigo: true })
  .partial()

// ─── Categoria ──────────────────────────────────────────────────────────────

const controlEnum = z.enum(['COMERCIAL', 'CALIDAD'])

export const categoriaBodySchema = mantenedorBaseSchema.extend({
  especieId: z.number().int().positive({ message: 'Selecciona una especie' }),
  orden: z.number().int().min(1, 'El orden debe ser mayor a 0'),
  control: z.array(controlEnum).default([]),
})

export const categoriaUpdateSchema = categoriaBodySchema
  .omit({ codigo: true })
  .partial()

// ─── Calibre ────────────────────────────────────────────────────────────────

export const calibreBodySchema = mantenedorBaseSchema.extend({
  especieId: z.number().int().positive({ message: 'Selecciona una especie' }),
  orden: z.number().int().min(1, 'El orden debe ser mayor a 0'),
  control: z.array(controlEnum).default([]),
  // Calibre equivalente (misma especie). Opcional al crear: si no viene, el
  // service lo deja apuntando a sí mismo.
  calibreEquivalenteId: z.number().int().positive().optional(),
})

export const calibreUpdateSchema = calibreBodySchema
  .omit({ codigo: true })
  .partial()

// ─── Parametro ──────────────────────────────────────────────────────────────

export const parametroBodySchema = mantenedorBaseSchema.extend({
  tipoParametroId: z.number().int().positive({ message: 'Selecciona un tipo de parámetro' }),
})

export const parametroUpdateSchema = parametroBodySchema
  .omit({ codigo: true })
  .partial()

// ─── Cláusula de Venta (Incoterm) ────────────────────────────────────────────
// Extraída de Parametro (2026-09-30) — mantenedor propio, sin tipoParametroId.

export const clausulaVentaBodySchema = mantenedorBaseSchema.extend({
  // Si al facturar/proformar con esta cláusula se exige Flete y/o Seguro (ej.
  // CIF → ambos, C+F/CFR → solo flete, FOB → ninguno). z.boolean().default(false)
  // — nunca z.coerce.boolean() (convertiría "false" string a true, bug
  // sistémico ya documentado en el proyecto).
  requiereFlete: z.boolean().default(false),
  requiereSeguro: z.boolean().default(false),
})

export const clausulaVentaUpdateSchema = clausulaVentaBodySchema
  .omit({ codigo: true })
  .partial()

// ─── Tipo de Reclamo (2026-10-01) ─────────────────────────────────────────────

export const tipoReclamoBodySchema = mantenedorBaseSchema.extend({
  // Si un reclamo de este tipo requiere análisis de Calidad (ej. "Calidad" sí,
  // "Comercial" no). z.boolean().default(false) — nunca z.coerce.boolean().
  generaAnalisisCalidad: z.boolean().default(false),
})

export const tipoReclamoUpdateSchema = tipoReclamoBodySchema
  .omit({ codigo: true })
  .partial()

// ─── Mercado ────────────────────────────────────────────────────────────────

export const mercadoBodySchema = mantenedorBaseSchema.extend({
  grupoMercadoId: z.number().int().positive({ message: 'Selecciona un grupo de mercado' }),
})

export const mercadoUpdateSchema = mercadoBodySchema
  .omit({ codigo: true })
  .partial()

// ─── Puerto ─────────────────────────────────────────────────────────────────

export const puertoBodySchema = mantenedorBaseSchema.extend({
  paisId: z.number().int().positive({ message: 'Selecciona un país' }),
  tipoEmbarqueId: z.number().int().positive({ message: 'Selecciona un tipo de embarque' }),
  latitud: z.number().min(-90).max(90).optional(),
  longitud: z.number().min(-180).max(180).optional(),
})

export const puertoUpdateSchema = puertoBodySchema
  .omit({ codigo: true })
  .partial()

// ─── Moneda ─────────────────────────────────────────────────────────────────

export const monedaBodySchema = mantenedorBaseSchema.extend({
  codigo: z
    .string()
    .length(3, 'El código de moneda debe ser ISO 4217 (3 letras)')
    .regex(/^[A-Z]{3}$/, 'El código debe ser 3 letras mayúsculas (ej: CLP, USD, EUR)')
    .trim(),
  esMonedaBase: z.boolean().default(false),
  decimales: z.number().int().min(0).max(6).default(2),
})

export const monedaUpdateSchema = monedaBodySchema.omit({ codigo: true }).partial()

// ─── ConceptoCtaCte ─────────────────────────────────────────────────────────

const naturalezaCuentaCorrienteEnum = z.enum(['DEBE', 'HABER', 'AMBOS'])

export const conceptoCtaCteBodySchema = mantenedorBaseSchema.extend({
  naturaleza: naturalezaCuentaCorrienteEnum,
})

export const conceptoCtaCteUpdateSchema = conceptoCtaCteBodySchema
  .omit({ codigo: true })
  .partial()

// ─── Temporada ───────────────────────────────────────────────────────────────

export const temporadaBodySchema = mantenedorBaseSchema
  .omit({ descripcionExtranjera: true })
  .extend({
    descripcionExtranjera: z.string().max(200).trim().optional(),
    fechaInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato requerido: YYYY-MM-DD'),
    fechaTermino: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato requerido: YYYY-MM-DD'),
    predeterminada: z.boolean().default(false),
  })
  .refine((d) => d.fechaInicio <= d.fechaTermino, {
    message: 'La fecha de inicio debe ser anterior o igual a la fecha de término',
    path: ['fechaTermino'],
  })

export const temporadaUpdateSchema = z.object({
  descripcion: z.string().min(1).max(200).trim().optional(),
  descripcionExtranjera: z.string().max(200).trim().optional(),
  fechaInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  fechaTermino: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  predeterminada: z.boolean().optional(),
  bloqueado: z.boolean().optional(),
})

// ─── Bodega ──────────────────────────────────────────────────────────────────

const tipoBodegaEnum = z.enum(['MATERIALES', 'EMBARQUE', 'DESPACHO'])

export const bodegaContactoSchema = z.object({
  id: z.number().int().positive().optional(),
  nombre: z.string().min(1, 'Requerido').max(200).trim(),
  email: z.string().email('Email inválido').max(200).trim().optional().or(z.literal('')),
  telefono: z.string().max(50).trim().optional(),
  orden: z.number().int().min(0).default(0),
})

export const bodegaBodySchema = mantenedorBaseSchema.extend({
  direccion: z.string().min(1, 'Requerido').max(300).trim(),
  comunaId: z.number().int().positive({ message: 'Selecciona una comuna' }),
  tipos: z.array(tipoBodegaEnum).min(1, 'Selecciona al menos un tipo de bodega'),
  latitud: z.number().min(-90).max(90).optional().nullable(),
  longitud: z.number().min(-180).max(180).optional().nullable(),
  contactos: z.array(bodegaContactoSchema).optional(),
})

export const bodegaUpdateSchema = bodegaBodySchema.omit({ codigo: true }).partial()

// ─── Types ──────────────────────────────────────────────────────────────────

export type MantenedorListQuery = z.infer<typeof mantenedorListQuerySchema>
export type MantenedorParams = z.infer<typeof mantenedorParamsSchema>
export type MantenedorBaseBody = z.infer<typeof mantenedorBaseSchema>
export type MantenedorUpdateBody = z.infer<typeof mantenedorUpdateSchema>
export type PaisBody = z.infer<typeof paisBodySchema>
export type PaisUpdateBody = z.infer<typeof paisUpdateSchema>
export type ProvinciaBody = z.infer<typeof provinciaBodySchema>
export type ComunaBody = z.infer<typeof comunaBodySchema>
export type GrupoVariedadBody = z.infer<typeof grupoVariedadBodySchema>
export type VariedadBody = z.infer<typeof variedadBodySchema>
export type EspecieBody = z.infer<typeof especieBodySchema>
export type CategoriaBody = z.infer<typeof categoriaBodySchema>
export type CalibreBody = z.infer<typeof calibreBodySchema>
export type ParametroBody = z.infer<typeof parametroBodySchema>
export type MercadoBody = z.infer<typeof mercadoBodySchema>
export type BodegaContactoInput = z.infer<typeof bodegaContactoSchema>
