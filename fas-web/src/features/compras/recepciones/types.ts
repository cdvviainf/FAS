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

export type OrigenRecepcion = 'COMPRA' | 'CONSIGNACION'
export type EstadoRecepcion = 'CARGADA' | 'VALIDADA' | 'RECHAZADA'

export const ORIGEN_RECEPCION_LABELS: Record<OrigenRecepcion, string> = {
  COMPRA: 'Compra',
  CONSIGNACION: 'Consignación',
}

export const ESTADO_RECEPCION_LABELS: Record<EstadoRecepcion, string> = {
  CARGADA: 'Cargada',
  VALIDADA: 'Validada',
  RECHAZADA: 'Rechazada',
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
}

export interface RecepcionDetalle extends RecepcionListItem {
  ordenCompraId: number | null
  direccionPlantaId: number
  direccionPlanta: DireccionRef
  templateCargaId: number | null
  templateCarga: MantenedorRef | null
  observaciones: string | null
  adjuntos: RecepcionAdjunto[]
  creadoPor: string
}

export interface RecepcionListResponse {
  data: RecepcionListItem[]
  meta: { total: number; page: number; limit: number; totalPages: number }
}

export interface RecepcionCreateInput {
  ordenCompraId?: number | null
  plantaId: number
  direccionPlantaId: number
  templateCargaId?: number | null
  observaciones?: string | null
}

export type RecepcionUpdateInput = Partial<Omit<RecepcionCreateInput, 'ordenCompraId'>>
