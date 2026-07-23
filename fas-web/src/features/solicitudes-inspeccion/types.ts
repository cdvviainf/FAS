export type EstadoSolicitud = 'PENDIENTE' | 'NOTIFICADA' | 'CERRADA'
export type FuncionAsignado = 'ACUDIR' | 'NOTIFICAR'
export type EtapaAdjunto = 'CREACION' | 'CIERRE'

export const ESTADO_LABELS: Record<EstadoSolicitud, string> = {
  PENDIENTE: 'Pendiente',
  NOTIFICADA: 'Notificada',
  CERRADA: 'Cerrada',
}

export const FUNCION_LABELS: Record<FuncionAsignado, string> = {
  ACUDIR: 'Acudir',
  NOTIFICAR: 'Notificar',
}

export interface AsignadoInput {
  usuarioId: string
  funcion: FuncionAsignado
}

export interface SolicitudAsignado {
  id: number
  usuarioId: string
  funcion: FuncionAsignado
  usuario: { id: string; nombre: string; email: string }
}

export interface SolicitudAdjunto {
  id: number
  nombre: string
  mime: string
  tamano: number
  etapa: EtapaAdjunto
  subidoEn: string
  subidoPor: string
}

export interface SolicitudInspeccion {
  id: number
  numero: number
  codigo: string
  temporadaId: number
  temporada: { id: number; codigo: string; descripcion: string }
  entidadProductorId: number
  entidadProductor: { id: number; codigo: string; descripcion: string; razonSocial: string }
  direccionId: number
  direccion: {
    id: number
    codigo: string
    direccion: string
    latitud: string | null
    longitud: string | null
    comuna: { id: number; descripcion: string } | null
    pais: { id: number; descripcion: string } | null
  }
  contactoId: number | null
  contacto: {
    id: number
    nombre: string
    email: string | null
    telefono: string | null
    whatsapp: string | null
    tipo: string | null
  } | null
  especieId: number | null
  especie: { id: number; codigo: string; descripcion: string } | null
  fechaHora: string
  motivoId: number
  motivo: { id: number; codigo: string; descripcion: string }
  observaciones: string | null
  estado: EstadoSolicitud
  notificadaEn: string | null
  comentariosCierre: string | null
  fechaCierre: string | null
  cerradaPor: string | null
  creadoEn: string
  creadoPor: string
  asignados: SolicitudAsignado[]
  adjuntos: SolicitudAdjunto[]
}

export interface SolicitudCreateInput {
  temporadaId: number
  entidadProductorId: number
  direccionId: number
  contactoId?: number | null
  especieId?: number | null
  fechaHora: string
  motivoId: number
  observaciones?: string | null
  asignados: AsignadoInput[]
}

export type SolicitudUpdateInput = Partial<Omit<SolicitudCreateInput, 'temporadaId'>>

export interface SolicitudListResponse {
  data: SolicitudInspeccion[]
  meta: { total: number; page: number; limit: number; totalPages: number }
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
