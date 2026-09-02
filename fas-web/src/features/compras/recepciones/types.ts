export interface EntidadRef {
  id: number
  codigo: string
  descripcion: string
  razonSocial: string
}

export interface DireccionRef {
  id: number
  codigo: string
  descripcion: string
  direccion: string
}

export interface MantenedorRef {
  id: number
  codigo: string
  descripcion: string
}

export type OrigenRecepcion = 'COMPRA' | 'CONSIGNACION' | 'PROCESO'
export type EstadoRecepcion = 'CARGADA' | 'VALIDADA' | 'RECHAZADA'

export const ORIGEN_RECEPCION_LABELS: Record<OrigenRecepcion, string> = {
  COMPRA: 'Compra',
  CONSIGNACION: 'Consignación',
  PROCESO: 'Proceso',
}

export const ESTADO_RECEPCION_LABELS: Record<EstadoRecepcion, string> = {
  CARGADA: 'Cargada',
  VALIDADA: 'Validada',
  RECHAZADA: 'Rechazada',
}

// Editable/eliminable/re-cargable — replica ESTADOS_MODIFICABLES +
// puedeModificarse() en recepciones.service.ts (backend): CARGADA (recién
// creada) o RECHAZADA (un intento anterior no cuadró; se corrige y se
// reintenta), pero solo si todavía no generó pallets. En consignación
// (compras.md §8) el estado se queda en CARGADA aunque ya haya generado
// pallets/Stock — por eso el estado por sí solo no basta (QA-RCV-002).
// El backend ya manda `editable` calculado (recepciones.service.ts,
// shapeRecepcion); esta función es el mismo criterio para el caso en que
// solo se tenga estado/tienePallets a mano.
export function esRecepcionEditable(recepcion: { estado: EstadoRecepcion; tienePallets: boolean }): boolean {
  return (recepcion.estado === 'CARGADA' || recepcion.estado === 'RECHAZADA') && !recepcion.tienePallets
}

export interface RecepcionAdjunto {
  id: number
  nombre: string
  mime: string
  tamano: number
  subidoEn: string
  subidoPor: string
}

export interface RecepcionListItem {
  id: number
  numero: string
  origen: OrigenRecepcion
  estado: EstadoRecepcion
  plantaId: number
  planta: EntidadRef
  ordenCompra: { id: number; numero: string } | null
  creadoEn: string
  // QA-RCV-002: el backend ya resuelve si hay pallets generados y si por lo
  // tanto sigue siendo editable — no reimplementar el criterio en la UI.
  tienePallets: boolean
  editable: boolean
}

// Instructivos de Embalaje seleccionados (modo PROCESO, 2026-09-01) —
// fijados al crear, no editables después.
export interface RecepcionInstructivoRef {
  instructivo: { id: number; numero: number }
}

export interface RecepcionDetalle extends RecepcionListItem {
  ordenCompraId: number | null
  instructivos: RecepcionInstructivoRef[]
  direccionPlantaId: number
  direccionPlanta: DireccionRef
  templateCargaId: number | null
  templateCarga: MantenedorRef | null
  observaciones: string | null
  adjuntos: RecepcionAdjunto[]
  creadoPor: string
  // Auditoría de advertencias aceptadas (modo PROCESO, 2026-09-02): la carga
  // tuvo filas que no calzaban con el detalle de los Instructivos
  // seleccionados y el usuario decidió cargar igual (todo o nada).
  advertenciasAceptadas: boolean
  advertenciasDetalle: string[] | null
  advertenciasAceptadasEn: string | null
  advertenciasAceptadasPor: string | null
}

export interface RecepcionListResponse {
  data: RecepcionListItem[]
  meta: { total: number; page: number; limit: number; totalPages: number }
}

export interface RecepcionCreateInput {
  ordenCompraId?: number | null
  esProceso?: boolean
  // Instructivos de Embalaje seleccionados — solo aplica en modo PROCESO,
  // obligatorio (mín. 1) en ese caso.
  instructivoIds?: number[]
  plantaId: number
  direccionPlantaId: number
  templateCargaId?: number | null
  observaciones?: string | null
}

export type RecepcionUpdateInput = Partial<Omit<RecepcionCreateInput, 'ordenCompraId' | 'esProceso' | 'instructivoIds'>>
