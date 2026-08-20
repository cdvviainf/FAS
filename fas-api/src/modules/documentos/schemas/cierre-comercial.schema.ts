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
  // Snapshot de NotaVenta.cuotasPago (no la plantilla CondicionPago viva) —
  // mismo shape crudo que orden-compra.schema.ts, la plantilla arma el texto.
  cuotas: z.array(z.object({
    plazoDias: z.number().int(),
    fechaReferencia: z.enum(['FACTURA', 'ZARPE', 'ENVIO_DOCUMENTOS']),
    tipoValor: z.enum(['PORCENTAJE', 'MONTO_UNITARIO']),
    porcentaje: z.string().nullable(),
    valorUnitario: z.string().nullable(),
    unidad: z.string().nullable(),
  })),
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
    // Kg Neto/Bruto (feedback Christian, 2026-08-19), mismo criterio que
    // orden-compra.schema.ts: Envase es el dato de catálogo, Neto/Bruto a
    // secas es el total de la línea (envase × cajas).
    kgNetoEnvase: z.string(),
    kgBrutoEnvase: z.string(),
    kgNeto: z.string(),
    kgBruto: z.string(),
    // fechaCompromiso: sacado (feedback Christian, 2026-08-19) — no está en
    // el documento original.
  })),
  totales: z.object({
    pallets: z.number().int(),
    cajas: z.number().int(),
    totalMonto: z.string(),
    kgNeto: z.string(),
    kgBruto: z.string(),
  }),
})

export type CierreComercialPdfPayload = z.infer<typeof cierreComercialPdfPayloadSchema>
