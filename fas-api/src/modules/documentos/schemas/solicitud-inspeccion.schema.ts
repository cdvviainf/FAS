import { z } from 'zod'

// Payload de la Solicitud de Inspección en PDF — snapshot del *pedido* de
// inspección (quién, cuándo, dónde, qué alcance, quién va), NO el informe de
// resultados por caja (defectos/madurez/fotos) de Docs/calidad.md, que es
// otro documento aún no construido (decisión de Christian, ver el ciclo que
// aprobó este alcance). Sin control de copia — ver instructivo-embalaje.schema.ts.
export const solicitudInspeccionPdfPayloadSchema = z.object({
  empresa: z.object({
    razonSocial: z.string(),
    rut: z.string().nullable(),
    direccion: z.string().nullable(),
    logoDataUri: z.string().nullable(),
  }),
  codigo: z.string(), // SI-{codTemporada}-{NNNN}
  fecha: z.string(), // ISO — fecha de creación de la Solicitud
  estado: z.string(), // label ya resuelto (ver LABELS en el resolver)
  fechaHoraVisita: z.string(), // ISO, con hora significativa
  productor: z.object({
    razonSocial: z.string(),
    rut: z.string().nullable(),
    direccion: z.string().nullable(),
    contacto: z.string().nullable(),
  }),
  mercado: z.string().nullable(),
  cliente: z.string().nullable(),
  especie: z.string().nullable(),
  fechaDespacho: z.string().nullable(), // ISO
  cantidadPallets: z.number().int().nullable(),
  notaCalidad: z.string().nullable(),
  notaCondicion: z.string().nullable(),
  variedades: z.array(z.string()),
  calibres: z.array(z.string()),
  categorias: z.array(z.string()),
  articulos: z.array(z.string()),
  paises: z.array(z.string()),
  asignados: z.array(z.object({
    nombre: z.string(),
    funcion: z.string(), // label ya resuelto
  })),
  observaciones: z.string().nullable(),
  usuarioSolicitante: z.string(),
  // Solo con datos si la Solicitud ya tiene un veredicto (estado
  // APROBADA/RECHAZADA/OBJETADA) — null mientras sigue PENDIENTE/NOTIFICADA.
  cierre: z.object({
    resultado: z.string(), // label ya resuelto
    comentarios: z.string().nullable(),
    fecha: z.string().nullable(), // ISO
  }).nullable(),
})

export type SolicitudInspeccionPdfPayload = z.infer<typeof solicitudInspeccionPdfPayloadSchema>
