import { api } from '@/lib/api'
import type {
  ProformaMaterialListResponse,
  ProformaMaterialDetalle,
  ProformaMaterialCreateInput,
  ProformaMaterialUpdateInput,
  ProformaMaterialLineaUpdateInput,
  ProformaMaterialLineaItem,
  ProformaMaterialListFilters,
} from './types'

export const proformasVentaMaterialService = {
  async list(params: ProformaMaterialListFilters = {}): Promise<ProformaMaterialListResponse> {
    const sp: Record<string, string> = {}
    if (params.page) sp.page = String(params.page)
    if (params.limit) sp.limit = String(params.limit)
    if (params.entidadId) sp.entidadId = String(params.entidadId)
    if (params.estado) sp.estado = params.estado
    return api.get('materiales/proformas', { searchParams: sp }).json()
  },

  async getById(id: number): Promise<{ data: ProformaMaterialDetalle }> {
    return api.get(`materiales/proformas/${id}`).json()
  },

  async create(data: ProformaMaterialCreateInput): Promise<{ data: ProformaMaterialDetalle }> {
    return api.post('materiales/proformas', { json: data }).json()
  },

  async update(id: number, data: ProformaMaterialUpdateInput): Promise<{ data: ProformaMaterialDetalle }> {
    return api.patch(`materiales/proformas/${id}`, { json: data }).json()
  },

  async updateLineaPrecio(id: number, lineaId: number, data: ProformaMaterialLineaUpdateInput): Promise<{ data: ProformaMaterialLineaItem }> {
    return api.patch(`materiales/proformas/${id}/lineas/${lineaId}`, { json: data }).json()
  },

  async enviarValidacion(id: number): Promise<{ data: ProformaMaterialDetalle }> {
    return api.post(`materiales/proformas/${id}/enviar-validacion`).json()
  },

  async anular(id: number): Promise<{ data: ProformaMaterialDetalle }> {
    return api.post(`materiales/proformas/${id}/anular`).json()
  },
}
