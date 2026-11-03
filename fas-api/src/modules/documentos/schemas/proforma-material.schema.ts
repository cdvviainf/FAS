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
  })),
  totales: z.object({
    neto: z.string(),
    iva: z.string(),
    total: z.string(),
  }),
})

export type ProformaMaterialPdfPayload = z.infer<typeof proformaMaterialPdfPayloadSchema>
