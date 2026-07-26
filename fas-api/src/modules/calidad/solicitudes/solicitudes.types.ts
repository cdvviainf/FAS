export type EstadoSolicitud = 'PENDIENTE' | 'NOTIFICADA' | 'CERRADA'
export type FuncionAsignado = 'ACUDIR' | 'NOTIFICAR'
export type EtapaAdjunto = 'CREACION' | 'CIERRE'

export interface AsignadoInput {
  usuarioId: string
  funcion: FuncionAsignado
}

export interface SolicitudCreateInput {
  entidadProductorId: number
  direccionId: number
  contactoId?: number | null
  especieId?: number | null
  fechaHora: string // ISO 8601
  motivoId: number
  mercadoId?: number | null
  paisIds?: number[]
  clienteId?: number | null
  fechaDespacho?: string | null
  cantidadPallets?: number | null
  calificacionId?: number | null
  variedadIds?: number[]
  calibreIds?: number[]
  categoriaIds?: number[]
  articuloIds?: number[]
  observaciones?: string | null
  asignados: AsignadoInput[]
}

export interface SolicitudUpdateInput {
  entidadProductorId?: number
  direccionId?: number
  contactoId?: number | null
  especieId?: number | null
  fechaHora?: string
  motivoId?: number
  mercadoId?: number | null
  paisIds?: number[]
  clienteId?: number | null
  fechaDespacho?: string | null
  cantidadPallets?: number | null
  calificacionId?: number | null
  variedadIds?: number[]
  calibreIds?: number[]
  categoriaIds?: number[]
  articuloIds?: number[]
  observaciones?: string | null
  asignados?: AsignadoInput[]
}

export interface SolicitudListFilters {
  q?: string
  page?: number
  limit?: number
  estado?: EstadoSolicitud
  temporadaId?: number
  entidadProductorId?: number
  usuarioAsignadoId?: string
  fechaDesde?: string
  fechaHasta?: string
}
