import { api } from '@/lib/api'
import type {
  DocumentoManualListResponse,
  DocumentoManualDetalle,
  DocumentoManualCreateInput,
  DocumentoManualUpdateInput,
  DocumentoManualListFilters,
  ReceptorDatosDte,
} from './types'

export const generadorDteService = {
  async list(params: DocumentoManualListFilters = {}): Promise<DocumentoManualListResponse> {
    const sp: Record<string, string> = {}
    if (params.page) sp.page = String(params.page)
    if (params.limit) sp.limit = String(params.limit)
    if (params.entidadId) sp.entidadId = String(params.entidadId)
    if (params.claseDocumento) sp.claseDocumento = params.claseDocumento
    if (params.estado) sp.estado = params.estado
    if (params.q?.trim()) sp.q = params.q.trim()
    return api.get('generador-dte', { searchParams: sp }).json()
  },

  async getById(id: number): Promise<{ data: DocumentoManualDetalle }> {
    return api.get(`generador-dte/${id}`).json()
  },

  async create(data: DocumentoManualCreateInput): Promise<{ data: DocumentoManualDetalle }> {
    return api.post('generador-dte', { json: data }).json()
  },

  async update(id: number, data: DocumentoManualUpdateInput): Promise<{ data: DocumentoManualDetalle }> {
    return api.patch(`generador-dte/${id}`, { json: data }).json()
  },

  async datosReceptor(entidadId: number): Promise<{ data: ReceptorDatosDte }> {
    return api.get(`generador-dte/receptor/${entidadId}`).json()
  },

  async anular(id: number): Promise<{ data: DocumentoManualDetalle }> {
    return api.post(`generador-dte/${id}/anular`).json()
  },
}
