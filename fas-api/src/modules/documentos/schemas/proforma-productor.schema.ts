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
  // Tipo de documento a facturar (2026-11-09, v3): 'Factura Nacional' / 'Factura Exenta'.
  tipoDocumento: z.string().optional(),
  // Discriminante tipado (BCOG-R8-001): 33 afecta / 34 exenta. v3 decide las
  // filas de totales por este valor, no por el monto.
  tipoDte: z.union([z.literal(33), z.literal(34)]).optional(),
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
    // Vencimiento estimado (2026-11-09, plantilla v3): fecha de la Proforma +
    // plazo, solo referencia FACTURA (YYYY-MM-DD); null si no se conoce.
    // Opcional para no romper reimpresiones v1/v2.
    vencimientoEstimado: z.string().nullable().optional(),
  })),
  totales: z.object({
    neto: z.string(),
    exento: z.string(),
    iva: z.string(),
    total: z.string(),
  }),
})

export type ProformaProductorPdfPayload = z.infer<typeof proformaProductorPdfPayloadSchema>
