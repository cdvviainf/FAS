import { z } from 'zod'

// Payload de la Orden de Compra en PDF — tipado extremo a extremo (Etapa 4
// §5): este schema es el contrato entre el resolver y la plantilla. Montos
// como string decimal (CLAUDE.md §7), nunca number.
export const ordenCompraPdfPayloadSchema = z.object({
  // Idioma de emisión (2026-10-26): la plantilla traduce etiquetas según esto.
  idioma: z.enum(['ES', 'EN']),
  // Imagen de la especie (primera por ID entre las líneas) para el banner del
  // encabezado — data URI embebido, null si la especie no tiene imagen.
  especieImagenDataUri: z.string().nullable(),
  empresa: z.object({
    // codigo (2026-08-20): decide en la plantilla si aplica el disclaimer
    // legal de facturación de Agrosan (ver DISCLAIMER_FACTURACION_AGROSAN,
    // v1/index.tsx) — no está definido todavía para otras empresas del tenant.
    codigo: z.string(),
    razonSocial: z.string(),
    rut: z.string().nullable(),
    direccion: z.string().nullable(),
    // data: URI (base64) — Playwright no toca la red al renderizar (Etapa 4
    // §6), así que el logo viaja embebido, nunca como <img src="http...">.
    logoDataUri: z.string().nullable(),
  }),
  numero: z.string(),
  // Modalidad de compra (2026-10-23): CAJAS o GRANEL — la plantilla elige las
  // columnas del detalle según esto.
  modalidad: z.enum(['CAJAS', 'GRANEL']),
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
  // Condiciones comerciales de compra a GRANEL (2026-10-27). Null en CAJAS.
  porcentajeMinExportacion: z.string().nullable(),
  modalidadEntregaGranel: z.enum(['PUESTA_EN_CAMPO', 'ENTREGADA_EN_PLANTA']).nullable(),
  envasesProporcionadosPor: z.enum(['PRODUCTOR', 'EXPORTADORA']).nullable(),
  encargadoDescartePor: z.enum(['PRODUCTOR', 'EXPORTADORA']).nullable(),
  // Snapshot de OrdenCompra.cuotasPago (no la plantilla CondicionPago viva —
  // ver Docs/compras.md §4.2.1, mismo criterio de inmutabilidad que el PDF).
  // Piezas crudas, sin formatear — la plantilla arma el texto con fmt.* (Etapa
  // 4 §5: "prohibido formatear a mano dentro de una plantilla").
  cuotas: z.array(z.object({
    plazoDias: z.number().int(),
    fechaReferencia: z.enum(['FACTURA', 'ZARPE', 'ENVIO_DOCUMENTOS', 'ARRIBO']),
    tipoValor: z.enum(['PORCENTAJE', 'MONTO_UNITARIO']),
    porcentaje: z.string().nullable(),
    valorUnitario: z.string().nullable(),
    unidad: z.string().nullable(),
  })),
  observaciones: z.string().nullable(),
  // Campos de cajas nullable desde que existe la modalidad GRANEL (2026-10-23):
  // en granel la línea solo trae cantidadKilos/precioUsdKilo; en cajas, los de
  // cajas y los de granel quedan null.
  lineas: z.array(z.object({
    especie: z.string(),
    variedad: z.string(),
    articulo: z.string(),
    etiqueta: z.string().nullable(),
    calibres: z.string(), // lista de calibres puntuales unida (compras.md §4.3 — supersede el rango legado); '' en granel
    categoria: z.string().nullable(),
    cantidadPallets: z.number().int().nullable(),
    cajas: z.number().int().nullable(),
    precioUsdCaja: z.string().nullable(),
    // Modalidad GRANEL: kilos comprados y precio USD por kilo.
    cantidadKilos: z.string().nullable(),
    precioUsdKilo: z.string().nullable(),
    totalUsd: z.string(),
    // Dato de catálogo (Articulo.kgNetoEnvase/kgBrutoEnvase) — distinto de
    // kgNeto/kgBruto abajo, que es el total de la línea (envase × cajas).
    kgNetoEnvase: z.string().nullable(),
    kgBrutoEnvase: z.string().nullable(),
    kgNeto: z.string().nullable(),
    kgBruto: z.string().nullable(),
  })),
  totales: z.object({
    pallets: z.number().int(),
    cajas: z.number().int(),
    kilos: z.string(),
    totalUsd: z.string(),
    kgNeto: z.string(),
    kgBruto: z.string(),
  }),
})

export type OrdenCompraPdfPayload = z.infer<typeof ordenCompraPdfPayloadSchema>
