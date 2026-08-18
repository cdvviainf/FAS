import type { ZodType } from 'zod'

export interface OpcionesPaginaDocumento {
  formato: 'A4' | 'Letter'
  orientacion: 'portrait' | 'landscape'
  margen: string
}

// Un documento del catálogo (Etapa 4 §4 "Registro central de documentos").
// `Payload` es el tipo del dato ya resuelto y validado con Zod — el mismo
// tipo que la plantilla recibe, así el compilador avisa si uno de los dos
// lados (resolver o plantilla) queda desalineado con el schema.
export interface DocumentDefinition<Payload = unknown> {
  titulo: string
  // Arma el payload desde la base de datos — SIN lógica de presentación
  // (Etapa 4 §4, paso "Resolver"). Lanza NotFoundError si el id no existe.
  resolver: (id: number, empresaId: number) => Promise<Payload>
  schema: ZodType<Payload>
  plantillaActual: string // clave dentro de `plantillas`, ej. 'v1'
  plantillas: Record<string, (props: { d: Payload; marcaAgua?: 'BORRADOR' | 'COPIA'; marcaAguaFecha?: string }) => React.ReactElement>
  pagina: OpcionesPaginaDocumento
  // Ítem de menú cuyo nivel LECTURA habilita preview/descarga y TOTAL habilita emitir.
  itemMenu: string
  nombreArchivo: (payload: Payload) => string
  folio: (payload: Payload) => string
}

// `any` a propósito (no `unknown`): el registro es heterogéneo — cada
// entrada tiene su propio Payload concreto, chequeado en su propio archivo
// (resolver + schema + plantilla). `unknown` rompe la asignación por
// varianza de funciones (resolver/plantillas reciben el Payload concreto,
// no unknown); forzarlo acá no agrega seguridad real, solo la traslada a un
// `as never`/cast en cada entrada.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DocumentRegistry = Record<string, DocumentDefinition<any>>
