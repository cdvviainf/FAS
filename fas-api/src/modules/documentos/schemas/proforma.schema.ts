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
    telefono: z.string().nullable().default(null),
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
  observaciones: z.string().nullable().default(null), // observaciones libres del documento
  // La misma plantilla sirve para la Proforma y para la Factura de Exportación
  // (DTE 110): `variante` cambia el título y `folio`/`tipoDte` se muestran solo
  // en la Factura ya timbrada.
  variante: z.enum(['PROFORMA', 'FACTURA']).default('PROFORMA'),
  folio: z.number().int().nullable().default(null),
  tipoDte: z.number().int().nullable().default(null),
  // precioUnitario/montoLinea van a valor FOB cuando la cláusula exige Flete/
  // Seguro (unitario × (montoTotal − flete − seguro) / montoTotal); si no,
  // coinciden con el valor cláusula. montoTotal es siempre el valor cláusula/CIF.
  lineas: z.array(
    z.object({
      descripcion: z.string(),
      cantidadCajas: z.number().int(),
      precioUnitario: z.number(),
      montoLinea: z.number(),
    }),
  ),
  // Desglose de la cláusula de venta (Incoterm). Null cuando la cláusula no lo
  // exige (ej. FOB). subtotalFob = montoTotal − flete − seguro (mercadería).
  montoFlete: z.number().nullable(),
  montoSeguro: z.number().nullable(),
  subtotalFob: z.number(),
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
  // Datos de transporte/exportación del Embarque (2026-10-30) — para que el PDF
  // muestre lo mismo que un "Export Invoice" de referencia. Todo opcional:
  // `transporte` es null si el documento no tiene Embarque resoluble, y cada
  // campo interno es null si el dato no se cargó aún. Solo datos, no cambia el
  // cálculo de montos/flete ni el DTE/XML.
  transporte: z
    .object({
      nave: z.string().nullable(),
      via: z.string().nullable(),
      blAwb: z.string().nullable(),
      tipoBl: z.string().nullable(),
      booking: z.string().nullable(),
      contenedor: z.string().nullable(),
      sello: z.string().nullable(),
      puertoEmbarque: z.string().nullable(),
      puertoDestino: z.string().nullable(),
      etd: z.string().nullable(), // ISO
      eta: z.string().nullable(), // ISO
      flete: z.string().nullable(),
      modalidadVenta: z.string().nullable(),
      incoterm: z.string().nullable(),
    })
    .nullable()
    .default(null),
  notify: z
    .object({
      razonSocial: z.string(),
      rut: z.string().nullable(),
      direccion: z.string().nullable(),
    })
    .nullable()
    .default(null),
  consignatario: z
    .object({
      razonSocial: z.string(),
      rut: z.string().nullable(),
      direccion: z.string().nullable(),
    })
    .nullable()
    .default(null),
  pesoNeto: z.number().nullable().default(null),
  pesoBruto: z.number().nullable().default(null),
  // Monto total (CIF) escrito en palabras según el idioma del documento.
  montoEnPalabras: z.string().nullable().default(null),
})

export type ProformaPdfPayload = z.infer<typeof proformaPdfPayloadSchema>
