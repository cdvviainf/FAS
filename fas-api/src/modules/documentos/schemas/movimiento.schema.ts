import { z } from 'zod'

// Payload de Movimiento en PDF — comparte resolver/schema entre las dos
// entradas del registro ('movimiento' y 'movimiento-guia-despacho'); la
// diferencia entre ambas es la plantilla, no el dato. `estado`/`emiteDTE`
// viajan para que el resolver de la variante Guía de Despacho pueda
// gatearse (movimiento.resolver.ts) sin repetir la consulta.
export const movimientoPdfPayloadSchema = z.object({
  empresa: z.object({
    codigo: z.string(),
    razonSocial: z.string(),
    rut: z.string().nullable(),
    direccion: z.string().nullable(),
    logoDataUri: z.string().nullable(),
  }),
  // Movimiento no tiene un correlativo humano propio (a diferencia de
  // OC/NV) — se sintetiza acá para el documento, no es una columna de BD.
  numero: z.string(),
  fecha: z.string(),
  estado: z.enum(['BORRADOR', 'CONFIRMADO']),
  emiteDTE: z.boolean(),
  tipoMovimiento: z.string(),
  clase: z.enum(['ENTRADA', 'SALIDA', 'TRASLADO']),
  bodegaOrigen: z.string().nullable(),
  bodegaDestino: z.string().nullable(),
  entidad: z.string().nullable(),
  guiaReferencia: z.string().nullable(),
  transporte: z.object({
    transportista: z.string().nullable(),
    choferRut: z.string().nullable(),
    choferNombre: z.string().nullable(),
    placaCamion: z.string().nullable(),
    placaRemolque: z.string().nullable(),
    horaSalida: z.string().nullable(),
    horaEstimadaLlegada: z.string().nullable(),
  }),
  lineas: z.array(z.object({
    articulo: z.string(),
    cantidad: z.string(),
    precioUnitario: z.string().nullable(),
    subtotal: z.string().nullable(),
  })),
  totales: z.object({
    cantidad: z.string(),
    subtotal: z.string().nullable(),
  }),
})

export type MovimientoPdfPayload = z.infer<typeof movimientoPdfPayloadSchema>
