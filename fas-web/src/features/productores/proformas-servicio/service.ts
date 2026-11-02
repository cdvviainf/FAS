import { api } from '@/lib/api'
import type {
  ProformaProductorListResponse,
  ProformaProductorDetalle,
  ProformaProductorCreateInput,
  ProformaProductorUpdateInput,
  ProformaProductorListFilters,
} from './types'

export const proformasProductorService = {
  async list(params: ProformaProductorListFilters = {}): Promise<ProformaProductorListResponse> {
    const sp: Record<string, string> = {}
    if (params.page) sp.page = String(params.page)
    if (params.limit) sp.limit = String(params.limit)
    if (params.entidadId) sp.entidadId = String(params.entidadId)
    if (params.estado) sp.estado = params.estado
    if (params.q?.trim()) sp.q = params.q.trim()
    return api.get('productores/proformas', { searchParams: sp }).json()
  },

  async getById(id: number): Promise<{ data: ProformaProductorDetalle }> {
    return api.get(`productores/proformas/${id}`).json()
  },

  async create(data: ProformaProductorCreateInput): Promise<{ data: ProformaProductorDetalle }> {
    return api.post('productores/proformas', { json: data }).json()
  },

  async update(id: number, data: ProformaProductorUpdateInput): Promise<{ data: ProformaProductorDetalle }> {
    return api.patch(`productores/proformas/${id}`, { json: data }).json()
  },

  async enviarValidacion(id: number): Promise<{ data: ProformaProductorDetalle }> {
    return api.post(`productores/proformas/${id}/enviar-validacion`).json()
  },

  async rechazar(id: number): Promise<{ data: ProformaProductorDetalle }> {
    return api.post(`productores/proformas/${id}/rechazar`).json()
  },

  async anular(id: number): Promise<{ data: ProformaProductorDetalle }> {
    return api.post(`productores/proformas/${id}/anular`).json()
  },
}
