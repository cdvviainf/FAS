import { z } from 'zod'

// Payload de la Proforma a Productor (servicios) en PDF — previsualización para
// revisar antes de aceptarla/rechazarla. Sin control de copia (una sola versión,
// sin emisión oficial — ver instructivo-embalaje.schema.ts). Labels/valores ya
// resueltos en el resolver (Etapa 4 §5: la plantilla no formatea).
export const proformaProductorPdfPayloadSchema = z.object({
  empresa: z.object({
    razonSocial: z.string(),
    rut: z.string().nullable(),
    direccion: z.string().nullable(),
    logoDataUri: z.string().nullable(),
  }),
  productor: z.object({
    razonSocial: z.string(),
    descripcion: z.string(),
    rut: z.string().nullable(), // Entidad.identificador
  }),
  numero: z.string(), // PVP-{AAAA}-{NNNN}
  fecha: z.string(), // ISO — fecha de creación
  estado: z.string(), // label ya resuelto
  moneda: z.string(), // código de moneda (fmt.moneda lo usa como prefijo)
  formaPago: z.string().nullable(),
  condicionPago: z.string().nullable(),
  observaciones: z.string().nullable(),
  lineas: z.array(z.object({
    descripcion: z.string(),
    cantidad: z.string(), // Decimal como string
    precioUnitario: z.string(),
    monto: z.string(),
    exento: z.boolean(),
  })),
  // Cuotas derivadas de la condición de pago (si aplica). Labels ya resueltos.
  cuotas: z.array(z.object({
    descripcion: z.string().nullable(),
    fechaReferencia: z.string(), // label ya resuelto
    plazoDias: z.number().int(),
    porcentaje: z.string().nullable(),
  })),
  totales: z.object({
    neto: z.string(),
    exento: z.string(),
    iva: z.string(),
    total: z.string(),
  }),
})

export type ProformaProductorPdfPayload = z.infer<typeof proformaProductorPdfPayloadSchema>
