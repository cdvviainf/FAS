import { api } from '@/lib/api'
import type {
  Integracion,
  IntegracionCreateInput,
  IntegracionUpdateInput,
  IntegracionListFilters,
  IntegracionListResponse,
  IntegracionParametro,
  IntegracionParametroInput,
  IntegracionParametroUpdateInput,
  MaestroIntegracion,
  OpcionMaestro,
} from './types'

export const integracionesService = {
  async list(filters: IntegracionListFilters = {}): Promise<IntegracionListResponse> {
    const sp: Record<string, string> = {}
    if (filters.page) sp.page = String(filters.page)
    if (filters.limit) sp.limit = String(filters.limit)
    return api.get('integraciones', { searchParams: sp }).json()
  },
  async getById(id: number): Promise<{ data: Integracion }> {
    return api.get(`integraciones/${id}`).json()
  },
  async create(data: IntegracionCreateInput): Promise<{ data: Integracion }> {
    return api.post('integraciones', { json: data }).json()
  },
  async update(id: number, data: IntegracionUpdateInput): Promise<{ data: Integracion }> {
    return api.patch(`integraciones/${id}`, { json: data }).json()
  },
  async remove(id: number): Promise<void> {
    await api.delete(`integraciones/${id}`)
  },
  async addParametro(integracionId: number, data: IntegracionParametroInput): Promise<{ data: IntegracionParametro }> {
    return api.post(`integraciones/${integracionId}/parametros`, { json: data }).json()
  },
  async updateParametro(integracionId: number, parametroId: number, data: IntegracionParametroUpdateInput): Promise<{ data: IntegracionParametro }> {
    return api.patch(`integraciones/${integracionId}/parametros/${parametroId}`, { json: data }).json()
  },
  async removeParametro(integracionId: number, parametroId: number): Promise<void> {
    await api.delete(`integraciones/${integracionId}/parametros/${parametroId}`)
  },
  async listOpcionesMaestro(maestro: MaestroIntegracion): Promise<{ data: OpcionMaestro[] }> {
    return api.get(`integraciones/maestros/${maestro}`).json()
  },
}
