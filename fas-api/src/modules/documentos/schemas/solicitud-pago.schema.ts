import { z } from 'zod'

// Payload del PDF de la Solicitud de Pago a Productores (2026-11-10).
export const solicitudPagoPdfPayloadSchema = z.object({
  empresa: z.object({
    razonSocial: z.string(),
    rut: z.string().nullable(),
    direccion: z.string().nullable(),
    logoDataUri: z.string().nullable(),
  }),
  numero: z.string(),
  fecha: z.string(), // ISO
  estado: z.string(), // label
  productor: z.object({ razonSocial: z.string(), rut: z.string().nullable(), direccion: z.string().nullable() }),
  moneda: z.string(),
  temporada: z.string(),
  observaciones: z.string().nullable(),
  cuotas: z.array(
    z.object({
      ordenCompra: z.string(),
      embarque: z.string(),
      cuota: z.string(),
      vencimiento: z.string().nullable(), // ISO
      montoCalculado: z.number(),
      montoSolicitado: z.number(),
      numeroFactura: z.string().nullable(),
    }),
  ),
  montoTotal: z.number(),
  pago: z
    .object({
      fechaPago: z.string().nullable(),
      numeroTransferencia: z.string().nullable(),
      concepto: z.string().nullable(),
    })
    .nullable(),
})

export type SolicitudPagoPdfPayload = z.infer<typeof solicitudPagoPdfPayloadSchema>
