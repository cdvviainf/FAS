import { z } from 'zod'

// Payload del Instructivo de Embalaje en PDF — sin control de copia (Etapa
// 4, ver documentos.types.ts#controlCopia): no hay distinción borrador/
// oficial, así que este schema no lleva nada relativo a emisión.
export const instructivoEmbalajePdfPayloadSchema = z.object({
  empresa: z.object({
    razonSocial: z.string(),
    rut: z.string().nullable(),
    direccion: z.string().nullable(),
    logoDataUri: z.string().nullable(),
  }),
  numero: z.string(),
  fecha: z.string(), // ISO — fecha de creación del Instructivo
  productor: z.object({
    razonSocial: z.string(),
    rut: z.string().nullable(),
    direccion: z.string().nullable(),
    contacto: z.string().nullable(),
  }),
  // Exportador (Entidad EXPORTADORA, 2026-10-05) — opcional, nivel cabecera.
  exportador: z.string().nullable(),
  fechaInicioPrograma: z.string(), // ISO
  semana: z.number().int(), // ISO — mismo cálculo que instructivo-form.tsx
  observaciones: z.string().nullable(),
  detalle: z.array(z.object({
    // Mercado a nivel de línea (2026-10-14, supersede grupoMercado).
    mercado: z.string(),
    especie: z.string(),
    variedad: z.string(),
    variedadRotulada: z.string().nullable(),
    categoria: z.string(),
    articulo: z.string(), // código del artículo (1ª línea)
    articuloDescripcion: z.string(), // descripción del artículo (2ª línea)
    etiqueta: z.string().nullable(),
    calibres: z.string(), // lista de calibres puntuales unida
    kgNetoEnvase: z.string().nullable(), // dato de catálogo, Articulo.kgNetoEnvase
    tipoPallet: z.string().nullable(),
    altura: z.string(),
    cantidadPallets: z.number().int(),
    cajasPorPallet: z.number().int(),
    cajas: z.number().int(),
    observaciones: z.string().nullable(),
  })),
  totales: z.object({
    pallets: z.number().int(),
    cajas: z.number().int(),
  }),
})

export type InstructivoEmbalajePdfPayload = z.infer<typeof instructivoEmbalajePdfPayloadSchema>
