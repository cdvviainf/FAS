import { z } from 'zod'

export const ordenCompraMaterialPdfPayloadSchema = z.object({
  empresa: z.object({
    codigo: z.string(),
    razonSocial: z.string(),
    rut: z.string().nullable(),
    direccion: z.string().nullable(),
    logoDataUri: z.string().nullable(),
  }),
  numero: z.string(),
  fecha: z.string(),
  proveedor: z.object({
    razonSocial: z.string(),
    rut: z.string().nullable(),
    direccion: z.string().nullable(),
    contacto: z.string().nullable(),
  }),
  formaPago: z.string().nullable(),
  moneda: z.string(),
  condicionPago: z.string().nullable(),
  observaciones: z.string().nullable(),
  cuotas: z.array(z.object({
    plazoDias: z.number(),
    fechaReferencia: z.enum(['FACTURA', 'ZARPE', 'ENVIO_DOCUMENTOS']),
    porcentaje: z.string(),
  })),
  lineas: z.array(z.object({
    articulo: z.string(),
    unidad: z.string(),
    cantidad: z.string(),
    precioUnitario: z.string(),
    monto: z.string(),
  })),
  totales: z.object({
    cantidad: z.string(),
    monto: z.string(),
  }),
})

export type OrdenCompraMaterialPdfPayload = z.infer<typeof ordenCompraMaterialPdfPayloadSchema>
