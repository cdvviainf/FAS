import { z } from 'zod'

// Payload del Instructivo de Embarque (InstructivoHijo, ventas.md R11) en
// PDF — un documento por Planta/punto de retiro dentro de un Embarque, no
// por Embarque completo. Sin control de copia (documentos.types.ts
// #controlCopia), mismo criterio que el Instructivo de Embalaje: no hay
// distinción borrador/oficial.
export const instructivoEmbarquePdfPayloadSchema = z.object({
  empresa: z.object({
    razonSocial: z.string(),
    rut: z.string().nullable(),
    direccion: z.string().nullable(),
    logoDataUri: z.string().nullable(),
  }),
  codigo: z.string(), // "{numeroInstructivo}-{n}", ej. "MAR0042-1"
  numeroInstructivoPadre: z.string(), // Folio del Embarque
  fecha: z.string(), // ISO — creación del InstructivoHijo
  planta: z.object({
    razonSocial: z.string(),
    direccion: z.string().nullable(),
  }),
  cliente: z.object({
    razonSocial: z.string(),
    rut: z.string().nullable(),
    direccion: z.string().nullable(),
  }),
  consignatario: z.string().nullable(),
  notify: z.string().nullable(),
  tipoEmbarque: z.string().nullable(),
  mercado: z.string().nullable(),
  paisDestino: z.string().nullable(),
  puertoDestino: z.string().nullable(),
  puertoZarpe: z.string().nullable(),
  voyageNumber: z.string().nullable(),
  deposito: z.string().nullable(),
  awbBl: z.string().nullable(),
  cutoffDate: z.string().nullable(), // ISO
  tipoBultos: z.string().nullable(),
  agenteAduana: z.string().nullable(),
  embarcador: z.string().nullable(),
  naviera: z.string().nullable(),
  numeroBooking: z.string().nullable(),
  nave: z.string().nullable(),
  numeroContenedor: z.string().nullable(),
  fechaZarpe: z.string().nullable(), // ISO
  fechaArribo: z.string().nullable(), // ISO — Embarque.fechaArribo (2026-09-22)
  fechaCargaPlanta: z.string().nullable(), // ISO
  // Stacking del contenedor (2026-09-22): compartido por todo el Embarque,
  // ya no por Planta — ver Embarque.stackingDesde/stackingHasta.
  stackingDesde: z.string().nullable(), // ISO
  stackingHasta: z.string().nullable(), // ISO
  // Observaciones generales del Instructivo (Embarque.observacionesInstructivo)
  // — distintas de `observaciones`, que sigue siendo por Planta.
  observacionesGenerales: z.string().nullable(),
  observaciones: z.string().nullable(),
  lineas: z.array(z.object({
    numeroPallet: z.string(),
    especie: z.string(),
    variedad: z.string(),
    categoria: z.string(),
    calibre: z.string(),
    articulo: z.string(),
    productor: z.string(),
    cajas: z.number().int(),
  })),
  totales: z.object({
    pallets: z.number().int(),
    cajas: z.number().int(),
  }),
})

export type InstructivoEmbarquePdfPayload = z.infer<typeof instructivoEmbarquePdfPayloadSchema>
