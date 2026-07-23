import { api } from '@/lib/api'
import type {
  SolicitudInspeccion,
  SolicitudListResponse,
  SolicitudListFilters,
  SolicitudCreateInput,
  SolicitudUpdateInput,
  SolicitudAdjunto,
  EtapaAdjunto,
} from './types'

export const solicitudesService = {
  async list(filters: SolicitudListFilters = {}): Promise<SolicitudListResponse> {
    const sp: Record<string, string> = {}
    if (filters.q) sp.q = filters.q
    if (filters.page) sp.page = String(filters.page)
    if (filters.limit) sp.limit = String(filters.limit)
    if (filters.estado) sp.estado = filters.estado
    if (filters.temporadaId) sp.temporadaId = String(filters.temporadaId)
    if (filters.entidadProductorId) sp.entidadProductorId = String(filters.entidadProductorId)
    if (filters.usuarioAsignadoId) sp.usuarioAsignadoId = filters.usuarioAsignadoId
    if (filters.fechaDesde) sp.fechaDesde = filters.fechaDesde
    if (filters.fechaHasta) sp.fechaHasta = filters.fechaHasta
    return api.get('calidad/solicitudes', { searchParams: sp }).json()
  },

  async getById(id: number): Promise<{ data: SolicitudInspeccion }> {
    return api.get(`calidad/solicitudes/${id}`).json()
  },

  async create(data: SolicitudCreateInput): Promise<{ data: SolicitudInspeccion }> {
    return api.post('calidad/solicitudes', { json: data }).json()
  },

  async update(id: number, data: SolicitudUpdateInput): Promise<{ data: SolicitudInspeccion }> {
    return api.patch(`calidad/solicitudes/${id}`, { json: data }).json()
  },

  async remove(id: number): Promise<void> {
    await api.delete(`calidad/solicitudes/${id}`)
  },

  async notificar(id: number): Promise<{ data: SolicitudInspeccion }> {
    return api.post(`calidad/solicitudes/${id}/notificar`).json()
  },

  async cerrar(id: number, comentarios: string): Promise<{ data: SolicitudInspeccion }> {
    return api.post(`calidad/solicitudes/${id}/cerrar`, { json: { comentarios } }).json()
  },

  async reabrir(id: number): Promise<{ data: SolicitudInspeccion }> {
    return api.post(`calidad/solicitudes/${id}/reabrir`).json()
  },

  async subirAdjunto(id: number, archivo: File, etapa: EtapaAdjunto): Promise<{ data: SolicitudAdjunto }> {
    const formData = new FormData()
    formData.append('file', archivo)
    return api
      .post(`calidad/solicitudes/${id}/adjuntos`, { body: formData, searchParams: { etapa } })
      .json()
  },

  async eliminarAdjunto(id: number, adjuntoId: number): Promise<void> {
    await api.delete(`calidad/solicitudes/${id}/adjuntos/${adjuntoId}`)
  },

  urlDescargaAdjunto(id: number, adjuntoId: number): string {
    const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api'
    return `${base}/calidad/solicitudes/${id}/adjuntos/${adjuntoId}/descarga`
  },
}
