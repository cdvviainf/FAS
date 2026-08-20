import { z } from 'zod'

// Payload de la Orden de Compra en PDF — tipado extremo a extremo (Etapa 4
// §5): este schema es el contrato entre el resolver y la plantilla. Montos
// como string decimal (CLAUDE.md §7), nunca number.
export const ordenCompraPdfPayloadSchema = z.object({
  empresa: z.object({
    razonSocial: z.string(),
    rut: z.string().nullable(),
    direccion: z.string().nullable(),
    // data: URI (base64) — Playwright no toca la red al renderizar (Etapa 4
    // §6), así que el logo viaja embebido, nunca como <img src="http...">.
    logoDataUri: z.string().nullable(),
  }),
  numero: z.string(),
  fecha: z.string(), // ISO — fmt.fecha la formatea en la plantilla
  responsable: z.string().nullable(),
  productor: z.object({
    razonSocial: z.string(),
    rut: z.string().nullable(),
    direccion: z.string().nullable(),
    contacto: z.string().nullable(),
  }),
  formaPago: z.string().nullable(),
  moneda: z.string(),
  incoterm: z.string().nullable(),
  destinoMercado: z.string().nullable(),
  // Snapshot de OrdenCompra.cuotasPago (no la plantilla CondicionPago viva —
  // ver Docs/compras.md §4.2.1, mismo criterio de inmutabilidad que el PDF).
  // Piezas crudas, sin formatear — la plantilla arma el texto con fmt.* (Etapa
  // 4 §5: "prohibido formatear a mano dentro de una plantilla").
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
    calibres: z.string(), // lista de calibres puntuales unida (compras.md §4.3 — supersede el rango legado)
    categoria: z.string(),
    cantidadPallets: z.number().int(),
    cajas: z.number().int(),
    precioUsdCaja: z.string(),
    totalUsd: z.string(),
    // Dato de catálogo (Articulo.kgNetoEnvase/kgBrutoEnvase) — distinto de
    // kgNeto/kgBruto abajo, que es el total de la línea (envase × cajas).
    kgNetoEnvase: z.string(),
    kgBrutoEnvase: z.string(),
    kgNeto: z.string(),
    kgBruto: z.string(),
  })),
  totales: z.object({
    pallets: z.number().int(),
    cajas: z.number().int(),
    totalUsd: z.string(),
    kgNeto: z.string(),
    kgBruto: z.string(),
  }),
})

export type OrdenCompraPdfPayload = z.infer<typeof ordenCompraPdfPayloadSchema>
