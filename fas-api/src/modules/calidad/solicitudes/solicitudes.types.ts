export type EstadoSolicitud = 'PENDIENTE' | 'NOTIFICADA' | 'APROBADA' | 'RECHAZADA' | 'OBJETADA'
export type ResultadoCierre = 'APROBADA' | 'RECHAZADA' | 'OBJETADA'
export type FuncionAsignado = 'ACUDIR' | 'NOTIFICAR'
export type EtapaAdjunto = 'CREACION' | 'CIERRE'

export interface AsignadoInput {
  usuarioId: string
  funcion: FuncionAsignado
}

export interface SolicitudCreateInput {
  usuarioSolicitanteId: string
  entidadProductorId: number
  direccionId: number
  contactoId?: number | null
  especieId?: number | null
  fechaHora: string // ISO 8601
  mercadoId?: number | null
  paisIds?: number[]
  clienteId?: number | null
  fechaDespacho?: string | null
  cantidadPallets?: number | null
  notaCalidadId?: number | null
  notaCondicionId?: number | null
  variedadIds?: number[]
  calibreIds?: number[]
  categoriaIds?: number[]
  articuloIds?: number[]
  observaciones?: string | null
  asignados: AsignadoInput[]
}

export interface SolicitudUpdateInput {
  usuarioSolicitanteId?: string
  entidadProductorId?: number
  direccionId?: number
  contactoId?: number | null
  especieId?: number | null
  fechaHora?: string
  mercadoId?: number | null
  paisIds?: number[]
  clienteId?: number | null
  fechaDespacho?: string | null
  cantidadPallets?: number | null
  notaCalidadId?: number | null
  notaCondicionId?: number | null
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
