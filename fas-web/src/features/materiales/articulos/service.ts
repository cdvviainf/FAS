import { api } from '@/lib/api'
import type {
  Articulo,
  ArticuloCreateInput,
  ArticuloUpdateInput,
  ArticuloListResponse,
  ArticuloListFilters,
  DocumentoArticulo,
} from './types'

export const articulosService = {
  async list(filters: ArticuloListFilters = {}): Promise<ArticuloListResponse> {
    const sp: Record<string, string> = {}
    if (filters.q) sp.q = filters.q
    if (filters.tipo) sp.tipo = filters.tipo
    if (filters.activo !== undefined) sp.activo = String(filters.activo)
    if (filters.page) sp.page = String(filters.page)
    if (filters.limit) sp.limit = String(filters.limit)
    return api.get('materiales/articulos', { searchParams: sp }).json()
  },

  async getById(id: number): Promise<{ data: Articulo }> {
    return api.get(`materiales/articulos/${id}`).json()
  },

  async create(data: ArticuloCreateInput): Promise<{ data: Articulo }> {
    return api.post('materiales/articulos', { json: data }).json()
  },

  async update(id: number, data: ArticuloUpdateInput): Promise<{ data: Articulo }> {
    return api.patch(`materiales/articulos/${id}`, { json: data }).json()
  },

  async listDocumentos(id: number): Promise<{ data: DocumentoArticulo[] }> {
    return api.get(`materiales/articulos/${id}/documentos`).json()
  },

  async subirDocumento(id: number, archivo: File): Promise<{ data: DocumentoArticulo }> {
    const formData = new FormData()
    formData.append('file', archivo)
    return api.post(`materiales/articulos/${id}/documentos`, { body: formData }).json()
  },

  async eliminarDocumento(id: number, docId: number): Promise<void> {
    await api.delete(`materiales/articulos/${id}/documentos/${docId}`)
  },

  urlDescargaDocumento(id: number, docId: number): string {
    const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api'
    return `${base}/materiales/articulos/${id}/documentos/${docId}/descarga`
  },
}
