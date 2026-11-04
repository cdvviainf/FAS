import { z } from 'zod'

// Payload del Documento Manual (Generador DTE) en PDF — previsualización de
// borrador. Labels/valores ya resueltos en el resolver (Etapa 4 §5). Sirve para
// las 4 clases (Factura Nacional, Guía de Despacho, Nota de Crédito, Nota de
// Débito); las secciones no aplicables vienen en null/vacías.
export const documentoManualPdfPayloadSchema = z.object({
  empresa: z.object({
    razonSocial: z.string(),
    rut: z.string().nullable(),
    direccion: z.string().nullable(),
    logoDataUri: z.string().nullable(),
  }),
  receptor: z.object({
    razonSocial: z.string(),
    descripcion: z.string(),
    rut: z.string().nullable(), // Entidad.identificador
  }),
  codigo: z.string(),
  claseLabel: z.string(), // "Factura Nacional", "Guía de Despacho", etc.
  tituloDocumento: z.string(), // título legible con el tipo DTE
  tipoDte: z.number().int(),
  fecha: z.string(), // ISO — fechaDocumento
  estado: z.string(), // label ya resuelto
  moneda: z.string(),
  condicionPago: z.string().nullable(),
  observaciones: z.string().nullable(),
  // Transporte (solo Guía). null cuando no aplica.
  transporte: z
    .object({
      indTraslado: z.string(), // label del tipo de traslado
      transportista: z.string().nullable(),
      chofer: z.string().nullable(),
      choferRut: z.string().nullable(),
      patenteCamion: z.string().nullable(),
      patenteRemolque: z.string().nullable(),
      origen: z.string().nullable(),
      destino: z.string().nullable(),
    })
    .nullable(),
  // Referencias (solo NC/ND).
  referencias: z.array(
    z.object({
      tipoDocRef: z.string(),
      folioRef: z.string(),
      fechaRef: z.string(),
      codRef: z.string().nullable(), // label (Anula/Corrige texto/Corrige monto)
      razonRef: z.string().nullable(),
    }),
  ),
  lineas: z.array(
    z.object({
      descripcion: z.string(),
      cantidad: z.string(),
      precioUnitario: z.string(),
      monto: z.string(),
      exento: z.boolean(),
    }),
  ),
  totales: z.object({
    neto: z.string(),
    exento: z.string(),
    iva: z.string(),
    total: z.string(),
  }),
})

export type DocumentoManualPdfPayload = z.infer<typeof documentoManualPdfPayloadSchema>
