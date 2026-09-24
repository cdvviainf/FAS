export type EstadoDocumentoDte =
  | 'PENDIENTE'
  | 'EMITIENDO'
  | 'TEMPORAL_CREADO'
  | 'GENERANDO'
  | 'GENERADO'
  | 'ERROR'

// Forma normalizada de "una parte" del DTE (emisor o receptor) — Empresa usa
// `rut` y Entidad usa `identificador` en su modelo Prisma, pero para armar el
// payload de LibreDTE ambos son lo mismo (un RUT), así que los lookups del
// repository ya devuelven esta forma común.
export interface ContraparteDte {
  rut: string | null
  giro: string | null
  razonSocial: string
  direccion: string | null
  comuna: string | null
}
