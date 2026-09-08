import { api } from '@/lib/api'
import type {
  LineaReclamable,
  LineasReclamablesResponse,
  PalletReclamable,
  Procedencia,
  Provision,
  ProvisionInput,
  Reclamo,
  ReclamoCreateInput,
  ReclamoUpdateInput,
  ReclamosListFilters,
  ReclamosListResponse,
} from './types'

export const reclamosService = {
  // ─── Creación/edición/listado por Embarque (Ventas) ──────────────────────
  async lineasReclamables(embarqueId: number): Promise<{ data: LineasReclamablesResponse }> {
    return api.get(`ventas/embarques/${embarqueId}/lineas-reclamables`).json()
  },
  async crear(embarqueId: number, body: ReclamoCreateInput): Promise<{ data: Reclamo }> {
    return api.post(`ventas/embarques/${embarqueId}/reclamos`, { json: body }).json()
  },
  // IMP-QA-R1-019: edición de cabecera/líneas mientras el reclamo no esté
  // CERRADO — reemplaza el set completo de líneas si `lineas` viene en el body.
  async actualizar(embarqueId: number, reclamoId: number, body: ReclamoUpdateInput): Promise<{ data: Reclamo }> {
    return api.patch(`ventas/embarques/${embarqueId}/reclamos/${reclamoId}`, { json: body }).json()
  },
  async listarPorEmbarque(embarqueId: number): Promise<{ data: Reclamo[] }> {
    return api.get(`ventas/embarques/${embarqueId}/reclamos`).json()
  },

  // ─── Análisis y ciclo de vida (Calidad) ──────────────────────────────────
  async list(filters: ReclamosListFilters = {}): Promise<ReclamosListResponse> {
    const sp: Record<string, string> = {}
    if (filters.page) sp.page = String(filters.page)
    if (filters.limit) sp.limit = String(filters.limit)
    if (filters.estado) sp.estado = filters.estado
    if (filters.embarqueId) sp.embarqueId = String(filters.embarqueId)
    if (filters.clienteId) sp.clienteId = String(filters.clienteId)
    if (filters.folio) sp.folio = filters.folio
    return api.get('calidad/reclamos', { searchParams: sp }).json()
  },
  async getById(id: number): Promise<{ data: Reclamo }> {
    return api.get(`calidad/reclamos/${id}`).json()
  },
  async actualizarAnalisis(id: number, comentarioCalidad: string): Promise<{ data: Reclamo }> {
    return api.patch(`calidad/reclamos/${id}/analisis`, { json: { comentarioCalidad } }).json()
  },
  async valorizar(id: number, valorConfirmado: number): Promise<{ data: Reclamo }> {
    return api.post(`calidad/reclamos/${id}/valorizar`, { json: { valorConfirmado } }).json()
  },
  async cerrar(id: number, procedencia: Procedencia): Promise<{ data: Reclamo }> {
    return api.post(`calidad/reclamos/${id}/cerrar`, { json: { procedencia } }).json()
  },
  async reabrir(id: number): Promise<{ data: Reclamo }> {
    return api.post(`calidad/reclamos/${id}/reabrir`).json()
  },

  // ─── Documentos ───────────────────────────────────────────────────────────
  async subirDocumento(id: number, archivo: File) {
    const formData = new FormData()
    formData.append('file', archivo)
    return api.post(`calidad/reclamos/${id}/documentos`, { body: formData }).json()
  },
  async eliminarDocumento(id: number, documentoId: number): Promise<void> {
    await api.delete(`calidad/reclamos/${id}/documentos/${documentoId}`)
  },
  urlDescargaDocumento(id: number, documentoId: number): string {
    return `/api/calidad/reclamos/${id}/documentos/${documentoId}`
  },

  // ─── Provisiones ────────────────────────────────────────────────────────
  async crearProvision(reclamoId: number, body: ProvisionInput): Promise<{ data: Provision }> {
    return api.post(`calidad/reclamos/${reclamoId}/provisiones`, { json: body }).json()
  },
  async listarProvisiones(reclamoId: number): Promise<{ data: Provision[] }> {
    return api.get(`calidad/reclamos/${reclamoId}/provisiones`).json()
  },
  async reversarProvision(id: number): Promise<{ data: Provision }> {
    return api.post(`calidad/provisiones/${id}/reversar`).json()
  },
}

export type { LineaReclamable, PalletReclamable }
