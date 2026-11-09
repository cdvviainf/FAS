import { z } from 'zod'

// Payload de la Proforma de Venta de Materiales en PDF — previsualización (sin
// control de copia, sin emisión oficial). Labels/valores ya resueltos en el
// resolver (Etapa 4 §5: la plantilla no formatea). Espejo de
// proforma-productor.schema, pero con `cliente` (Entidad) y líneas de materiales
// (todas afectas — sin columna exento).
export const proformaMaterialPdfPayloadSchema = z.object({
  empresa: z.object({
    razonSocial: z.string(),
    rut: z.string().nullable(),
    direccion: z.string().nullable(),
    logoDataUri: z.string().nullable(),
  }),
  cliente: z.object({
    razonSocial: z.string(),
    descripcion: z.string(),
    rut: z.string().nullable(), // Entidad.identificador
  }),
  numero: z.string(), // PVM-{AAAA}-{NNNN}
  fecha: z.string(), // ISO — fecha de creación
  estado: z.string(), // label ya resuelto
  moneda: z.string(), // código de moneda
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
  })),
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
    // Exenta (34): monto exento (v3 lo muestra en vez de Neto/IVA). v2 usa neto.
    exento: z.string().optional(),
    iva: z.string(),
    total: z.string(),
  }),
})

export type ProformaMaterialPdfPayload = z.infer<typeof proformaMaterialPdfPayloadSchema>
