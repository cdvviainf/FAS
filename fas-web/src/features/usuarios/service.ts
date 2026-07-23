import { api } from '@/lib/api'
import type { Usuario, UsuarioListResponse, UsuarioCreateInput, UsuarioUpdateInput } from './types'

export const usuariosService = {
  async list(params: { page?: number; limit?: number; q?: string; perfilId?: number } = {}): Promise<UsuarioListResponse> {
    const searchParams: Record<string, string> = {}
    if (params.page) searchParams.page = String(params.page)
    if (params.limit) searchParams.limit = String(params.limit)
    if (params.q) searchParams.q = params.q
    if (params.perfilId) searchParams.perfilId = String(params.perfilId)
    return api.get('config/usuarios', { searchParams }).json()
  },

  async getById(id: string): Promise<Usuario> {
    return api.get(`config/usuarios/${id}`).json()
  },

  async create(data: UsuarioCreateInput): Promise<Usuario> {
    return api.post('config/usuarios', { json: data }).json()
  },

  async update(id: string, data: UsuarioUpdateInput): Promise<Usuario> {
    return api.patch(`config/usuarios/${id}`, { json: data }).json()
  },

  async changePassword(id: string, data: { password: string; passwordConfirm: string }): Promise<void> {
    await api.post(`config/usuarios/${id}/password`, { json: data })
  },

  async remove(id: string): Promise<void> {
    await api.delete(`config/usuarios/${id}`)
  },

  async subirAvatar(id: string, file: File): Promise<Usuario> {
    const formData = new FormData()
    formData.append('file', file)
    return api.post(`config/usuarios/${id}/avatar`, { body: formData }).json()
  },

  async eliminarAvatar(id: string): Promise<void> {
    await api.delete(`config/usuarios/${id}/avatar`)
  },

  avatarSrc(imagenUrl: string | null): string | null {
    if (!imagenUrl) return null
    return `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api'}${imagenUrl}`
  },
}
