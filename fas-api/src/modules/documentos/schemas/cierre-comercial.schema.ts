import { z } from 'zod'

// Payload del Cierre Comercial (modelo NotaVenta) en PDF — mismo criterio que
// orden-compra.schema.ts: montos como string decimal (CLAUDE.md §7), nunca
// number. CON control de copia (documentos.types.ts#controlCopia) — tiene
// versión BORRADOR y Emitir/reimpresión, igual que la Orden de Compra.
export const cierreComercialPdfPayloadSchema = z.object({
  empresa: z.object({
    razonSocial: z.string(),
    rut: z.string().nullable(),
    direccion: z.string().nullable(),
    logoDataUri: z.string().nullable(),
  }),
  // Exportador del Cierre (NotaVenta.exportadorId, 2026-11-05); si el Cierre
  // no tiene exportador se usan los datos de la empresa.
  exportador: z.object({
    razonSocial: z.string(),
    rut: z.string().nullable(),
    direccion: z.string().nullable(),
  }),
  // Responsable de venta (cabecera) + su firma PNG (sobre la línea de firma).
  responsableVenta: z.string().nullable(),
  firmaResponsableDataUri: z.string().nullable(),
  // Calidad / Condición "hasta" (2026-11-05).
  calidadHasta: z.string().nullable(),
  condicionHasta: z.string().nullable(),
  folio: z.string(),
  fecha: z.string(), // ISO
  cliente: z.object({
    razonSocial: z.string(),
    rut: z.string().nullable(),
    direccion: z.string().nullable(),
    contacto: z.string().nullable(),
  }),
  compradorContacto: z.string().nullable(),
  notify: z.string().nullable(),
  consignatario: z.string().nullable(),
  tipoEmbarque: z.string().nullable(),
  mercado: z.string().nullable(),
  paisDestino: z.string().nullable(),
  puertoDestino: z.string().nullable(),
  // direccion/direccionDetalle: sacados (feedback Christian, 2026-08-19) —
  // no están en el documento original.
  modalidadVenta: z.string().nullable(),
  clausulaVenta: z.string().nullable(),
  tipoFlete: z.string().nullable(),
  condicionPago: z.string().nullable(),
  moneda: z.string(),
  // Cuotas: eliminadas del PDF (2026-11-05, pedido del cliente) — solo se
  // muestra la condición de pago.
  observaciones: z.string().nullable(),
  lineas: z.array(z.object({
    especie: z.string(),
    variedad: z.string(),
    articulo: z.string(),
    etiqueta: z.string().nullable(),
    calibres: z.string(),
    categoria: z.string().nullable(),
    tipoPallet: z.string().nullable(),
    cantidadPallets: z.number().int(),
    cajasPorPallet: z.number().int(),
    cajas: z.number().int(),
    precio: z.string(),
    total: z.string(),
    // Solo Kg Neto por envase (2026-11-05): se eliminaron Kg Bruto Envase
    // (unitario bruto) y los kilos totales Neto/Bruto, a pedido del cliente.
    kgNetoEnvase: z.string(),
    // fechaCompromiso: sacado (feedback Christian, 2026-08-19) — no está en
    // el documento original.
  })),
  totales: z.object({
    pallets: z.number().int(),
    cajas: z.number().int(),
    totalMonto: z.string(),
  }),
})

export type CierreComercialPdfPayload = z.infer<typeof cierreComercialPdfPayloadSchema>
