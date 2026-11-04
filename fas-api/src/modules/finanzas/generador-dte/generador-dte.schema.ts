import { z } from 'zod'

// Generador DTE — documentos manuales (2026-11-04). Validación por clase.

export const claseDocumentoEnum = z.enum(['FACTURA_NACIONAL', 'GUIA_DESPACHO', 'NOTA_CREDITO', 'NOTA_DEBITO'])
export const estadoDocumentoEnum = z.enum(['BORRADOR', 'ENVIADA_SII', 'APROBADA', 'RECHAZADA', 'ANULADA'])

// Línea de detalle: glosa libre (siempre) + artículo opcional + exento por línea.
// Mismo criterio que la Proforma de Productor / Factura Nacional.
export const lineaSchema = z.object({
  descripcion: z.string().min(1, 'La glosa/descripción de la línea es requerida').max(1000),
  articuloId: z.number().int().positive().nullable().optional(),
  cantidad: z.number().positive('La cantidad debe ser mayor a 0'),
  precioUnitario: z.number().nonnegative('El precio no puede ser negativo'),
  exento: z.boolean().default(false),
})

// Referencia (NC/ND): campos crudos SII siempre presentes; el enlace blando
// (refOrigenTipo/refOrigenId) es opcional — se usa cuando se referencia un
// documento del sistema para trazabilidad (los campos crudos se prellenan desde él).
export const referenciaSchema = z.object({
  tipoDocRef: z.string().min(1, 'El tipo de documento de referencia es requerido').max(10),
  folioRef: z.string().min(1, 'El folio de referencia es requerido').max(40),
  fechaRef: z.string().date(),
  codRef: z.number().int().min(1).max(3).nullable().optional(),
  razonRef: z.string().max(90).nullable().optional(),
  refOrigenTipo: z.string().max(60).nullable().optional(),
  refOrigenId: z.number().int().positive().nullable().optional(),
})

// Datos de transporte (solo GUIA_DESPACHO). RUT del chofer exigido solo si chileno
// (se valida en el service, igual que la Guía de embarque).
export const transporteSchema = z.object({
  indTraslado: z.number().int().min(1).max(9),
  transporteId: z.number().int().positive().nullable().optional(),
  choferChileno: z.boolean().default(true),
  choferRut: z.string().max(20).nullable().optional(),
  choferNombre: z.string().max(100).nullable().optional(),
  patenteCamion: z.string().max(12).nullable().optional(),
  patenteRemolque: z.string().max(12).nullable().optional(),
  dirOrigen: z.string().max(200).nullable().optional(),
  comunaOrigen: z.string().max(100).nullable().optional(),
  dirDestino: z.string().max(200).nullable().optional(),
  comunaDestino: z.string().max(100).nullable().optional(),
})

const baseCreate = z.object({
  claseDocumento: claseDocumentoEnum,
  entidadId: z.number().int().positive('El receptor es requerido'),
  monedaId: z.number().int().positive('La moneda es requerida'),
  tipoCambio: z.number().positive().nullable().optional(),
  fechaDocumento: z.string().date(),
  condicionPagoId: z.number().int().positive().nullable().optional(),
  idioma: z.enum(['ES', 'EN']).default('ES'),
  observaciones: z.string().max(5000).nullable().optional(),
  transporte: transporteSchema.nullable().optional(),
  referencias: z.array(referenciaSchema).optional(),
  lineas: z.array(lineaSchema).min(1, 'Debe agregar al menos una línea de detalle'),
})

// Reglas por clase: guía exige transporte; NC/ND exigen ≥1 referencia.
function refinarPorClase(v: z.infer<typeof baseCreate>, ctx: z.RefinementCtx) {
  if (v.claseDocumento === 'GUIA_DESPACHO' && (v.transporte == null || v.transporte.indTraslado == null)) {
    ctx.addIssue({ code: 'custom', message: 'La Guía de Despacho requiere los datos de transporte (tipo de traslado)', path: ['transporte'] })
  }
  if ((v.claseDocumento === 'NOTA_CREDITO' || v.claseDocumento === 'NOTA_DEBITO') && (v.referencias == null || v.referencias.length === 0)) {
    ctx.addIssue({ code: 'custom', message: 'La Nota de Crédito/Débito requiere al menos un documento de referencia', path: ['referencias'] })
  }
}

export const documentoManualCreateSchema = baseCreate.superRefine(refinarPorClase)

// En update la clase no se cambia (define las reglas/estructura). Se omite y se
// re-valida contra la clase persistida en el service.
export const documentoManualUpdateSchema = baseCreate.omit({ claseDocumento: true }).partial()

export const documentoManualParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
})

export const documentoManualListQuerySchema = z.object({
  q: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(20),
  claseDocumento: claseDocumentoEnum.optional(),
  estado: estadoDocumentoEnum.optional(),
  entidadId: z.coerce.number().int().positive().optional(),
})

export type DocumentoManualCreateBody = z.infer<typeof documentoManualCreateSchema>
export type DocumentoManualUpdateBody = z.infer<typeof documentoManualUpdateSchema>
