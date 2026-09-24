import { z } from 'zod'

// Payload de la Proforma de Exportación (Docs/cobranza.md, primera etapa del
// módulo de Facturación/Cobranza, 2026-09-24) — documento comercial (D12: "no
// requiere folio SII ni CAF"), con control de copia (se envía al cliente,
// admite reimpresión con marca de agua igual que la OC).
export const proformaPdfPayloadSchema = z.object({
  empresa: z.object({
    razonSocial: z.string(),
    rut: z.string().nullable(),
    direccion: z.string().nullable(),
    logoDataUri: z.string().nullable(),
  }),
  codigo: z.string(),
  numeroInstructivo: z.string(), // folio del Embarque
  fechaEmision: z.string(), // ISO
  idioma: z.enum(['EN', 'ES']),
  cliente: z.object({
    razonSocial: z.string(),
    rut: z.string().nullable(),
    direccion: z.string().nullable(),
  }),
  moneda: z.string(), // código, ej. "USD"
  condicionPago: z.string().nullable(), // descripción de la CondicionPago heredada
  lineas: z.array(
    z.object({
      descripcion: z.string(),
      cantidadCajas: z.number().int(),
      precioUnitario: z.number(),
      montoLinea: z.number(),
    }),
  ),
  montoTotal: z.number(),
  // Tabla de vencimientos estimada (D4: "calculada al vuelo, sin persistir
  // Cuota") — a partir de las cuotas snapshoteadas de la Nota de Venta
  // (NotaVentaCuotaPago), recalculadas contra el montoTotal real de esta
  // Proforma cuando son porcentuales.
  vencimientosEstimados: z.array(
    z.object({
      numeroCuota: z.number().int(),
      descripcion: z.string().nullable(),
      monto: z.number(),
      // Clave cruda de FechaReferenciaPago (schema.prisma) — ProformaV1
      // traduce según `idioma` (FAS-PROF-EXP-006, QA ronda 1).
      fechaReferencia: z.enum(['FACTURA', 'ZARPE', 'ENVIO_DOCUMENTOS', 'ARRIBO']),
      plazoDias: z.number().int(),
      fechaEstimada: z.string().nullable(), // ISO — null si la fecha base aún no se conoce
    }),
  ),
})

export type ProformaPdfPayload = z.infer<typeof proformaPdfPayloadSchema>
