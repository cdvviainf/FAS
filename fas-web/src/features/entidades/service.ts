import { api } from '@/lib/api'
import type {
  EntidadListResponse,
  EntidadDetalle,
  EntidadCreateInput,
  DireccionCreateInput,
  ContactoCreateInput,
  TipoEntidad,
  PaisOption,
  ComunaOption,
} from './types'

export const entidadesService = {
  async list(params: { page?: number; limit?: number; q?: string; tipo?: TipoEntidad; activo?: boolean } = {}): Promise<EntidadListResponse> {
    const sp: Record<string, string> = {}
    if (params.page) sp.page = String(params.page)
    if (params.limit) sp.limit = String(params.limit)
    if (params.q) sp.q = params.q
    if (params.tipo) sp.tipo = params.tipo
    if (params.activo !== undefined) sp.activo = String(params.activo)
    return api.get('config/entidades', { searchParams: sp }).json()
  },

  async getById(id: number): Promise<EntidadDetalle> {
    return api.get(`config/entidades/${id}`).json()
  },

  async create(data: EntidadCreateInput): Promise<EntidadDetalle> {
    return api.post('config/entidades', { json: data }).json()
  },

  async update(id: number, data: Partial<EntidadCreateInput>): Promise<EntidadDetalle> {
    return api.patch(`config/entidades/${id}`, { json: data }).json()
  },

  async remove(id: number): Promise<void> {
    await api.delete(`config/entidades/${id}`)
  },

  async createDireccion(entidadId: number, data: DireccionCreateInput) {
    return api.post(`config/entidades/${entidadId}/direcciones`, { json: data }).json()
  },

  async updateDireccion(entidadId: number, dirId: number, data: Partial<DireccionCreateInput>) {
    return api.patch(`config/entidades/${entidadId}/direcciones/${dirId}`, { json: data }).json()
  },

  async deleteDireccion(entidadId: number, dirId: number): Promise<void> {
    await api.delete(`config/entidades/${entidadId}/direcciones/${dirId}`)
  },

  async createContacto(entidadId: number, data: ContactoCreateInput) {
    return api.post(`config/entidades/${entidadId}/contactos`, { json: data }).json()
  },

  async updateContacto(entidadId: number, conId: number, data: Partial<ContactoCreateInput>) {
    return api.patch(`config/entidades/${entidadId}/contactos/${conId}`, { json: data }).json()
  },

  async deleteContacto(entidadId: number, conId: number): Promise<void> {
    await api.delete(`config/entidades/${entidadId}/contactos/${conId}`)
  },

  async listPaises(): Promise<{ data: PaisOption[] }> {
    return api.get('config/paises', { searchParams: { limit: '200' } }).json()
  },

  async listComunas(limit = 500): Promise<{ data: ComunaOption[] }> {
    return api.get('config/comunas', { searchParams: { limit: String(limit) } }).json()
  },
}
