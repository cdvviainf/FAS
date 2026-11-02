import { z } from 'zod'

// Payload de la Ficha de Productor en PDF — snapshot de los datos maestros del
// productor: identificación + direcciones/contactos + predios + contrato
// vigente. NO incluye cuenta corriente (decisión de Christian, 2026-10-31).
// Sin control de copia — ver instructivo-embalaje.schema.ts. Labels/valores ya
// resueltos en el resolver (Etapa 4 §5: la plantilla no formatea).
export const fichaProductorPdfPayloadSchema = z.object({
  fechaGeneracion: z.string(), // ISO — fecha de generación de la ficha
  empresa: z.object({
    razonSocial: z.string(),
    rut: z.string().nullable(),
    direccion: z.string().nullable(),
    logoDataUri: z.string().nullable(),
  }),
  productor: z.object({
    codigo: z.string(),
    razonSocial: z.string(),
    descripcion: z.string(),
    rut: z.string().nullable(), // Entidad.identificador
    activo: z.boolean(),
    pais: z.string().nullable(),
    telefono: z.string().nullable(),
    email: z.string().nullable(),
    direcciones: z.array(z.object({
      descripcion: z.string(),
      direccion: z.string(),
      comuna: z.string().nullable(),
      pais: z.string().nullable(),
    })),
    contactos: z.array(z.object({
      nombre: z.string(),
      tipo: z.string().nullable(),
      rut: z.string().nullable(),
      telefono: z.string().nullable(),
      email: z.string().nullable(),
      esRepresentanteLegal: z.boolean(),
    })),
  }),
  predios: z.array(z.object({
    codigo: z.string(),
    descripcion: z.string(),
    direccion: z.string().nullable(),
    comuna: z.string().nullable(),
    tipoProduccion: z.string().nullable(),
  })),
  // Contrato vigente / más reciente del productor. null si no tiene ninguno.
  contrato: z.object({
    temporada: z.string(),
    especie: z.string(),
    fechaInicio: z.string(), // ISO
    fechaTermino: z.string(), // ISO
    lineas: z.array(z.object({
      articulo: z.string(),
      variedad: z.string(),
      calibre: z.string(), // "desde — hasta" ya resuelto
      categoria: z.string(),
      unidad: z.string(),
      cantidadComprometida: z.string(), // Decimal como string
      minimoGarantizado: z.string(), // Decimal como string
    })),
  }).nullable(),
})

export type FichaProductorPdfPayload = z.infer<typeof fichaProductorPdfPayloadSchema>
