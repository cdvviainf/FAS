import { api } from '@/lib/api'
import type {
  EmpresaListResponse,
  EmpresaDetalle,
  EmpresaCreateInput,
  DireccionCreateInput,
  ContactoCreateInput,
  PaisOption,
  ComunaOption,
} from './types'

export const empresasService = {
  async list(params: { page?: number; limit?: number; q?: string; activo?: boolean } = {}): Promise<EmpresaListResponse> {
    const sp: Record<string, string> = {}
    if (params.page) sp.page = String(params.page)
    if (params.limit) sp.limit = String(params.limit)
    if (params.q) sp.q = params.q
    if (params.activo !== undefined) sp.activo = String(params.activo)
    return api.get('config/empresas', { searchParams: sp }).json()
  },

  async getById(id: number): Promise<EmpresaDetalle> {
    return api.get(`config/empresas/${id}`).json()
  },

  async create(data: EmpresaCreateInput): Promise<EmpresaDetalle> {
    return api.post('config/empresas', { json: data }).json()
  },

  async update(id: number, data: Partial<EmpresaCreateInput>): Promise<EmpresaDetalle> {
    return api.patch(`config/empresas/${id}`, { json: data }).json()
  },

  async remove(id: number): Promise<void> {
    await api.delete(`config/empresas/${id}`)
  },

  async createDireccion(empresaId: number, data: DireccionCreateInput) {
    return api.post(`config/empresas/${empresaId}/direcciones`, { json: data }).json()
  },

  async updateDireccion(empresaId: number, dirId: number, data: Partial<DireccionCreateInput>) {
    return api.patch(`config/empresas/${empresaId}/direcciones/${dirId}`, { json: data }).json()
  },

  async deleteDireccion(empresaId: number, dirId: number): Promise<void> {
    await api.delete(`config/empresas/${empresaId}/direcciones/${dirId}`)
  },

  async createContacto(empresaId: number, data: ContactoCreateInput) {
    return api.post(`config/empresas/${empresaId}/contactos`, { json: data }).json()
  },

  async updateContacto(empresaId: number, conId: number, data: Partial<ContactoCreateInput>) {
    return api.patch(`config/empresas/${empresaId}/contactos/${conId}`, { json: data }).json()
  },

  async deleteContacto(empresaId: number, conId: number): Promise<void> {
    await api.delete(`config/empresas/${empresaId}/contactos/${conId}`)
  },

  async subirLogo(empresaId: number, file: File): Promise<void> {
    const formData = new FormData()
    formData.append('file', file)
    await api.post(`config/empresas/${empresaId}/logo`, { body: formData })
  },

  async eliminarLogo(empresaId: number): Promise<void> {
    await api.delete(`config/empresas/${empresaId}/logo`)
  },

  // Ruta relativa (mismo origen) para que el navegador envíe la cookie de
  // sesión vía el proxy — ver comentario en src/app/api/[...path]/route.ts
  // y el mismo patrón en usuariosService.avatarSrc. `version` (subidoEn) va
  // como query param para invalidar la caché del navegador tras un reemplazo
  // — el endpoint responde con Cache-Control: max-age=300 y la URL es
  // estática, así que sin esto el admin seguiría viendo el logo viejo.
  logoSrc(empresaId: number, version?: string): string {
    const base = `/api/config/empresas/${empresaId}/logo`
    return version ? `${base}?v=${encodeURIComponent(version)}` : base
  },

  async listPaises(): Promise<{ data: PaisOption[] }> {
    return api.get('config/paises', { searchParams: { limit: '200' } }).json()
  },

  async listComunas(limit = 500): Promise<{ data: ComunaOption[] }> {
    return api.get('config/comunas', { searchParams: { limit: String(limit) } }).json()
  },
}
