import { api } from '@/lib/api'
import type { AuditoriaFacetas, AuditoriaListParams, AuditoriaListResponse } from './types'

function buildSearchParams(params: AuditoriaListParams): Record<string, string> {
  const sp: Record<string, string> = {}
  if (params.page) sp.page = String(params.page)
  if (params.limit) sp.limit = String(params.limit)
  if (params.usuarioId) sp.usuarioId = params.usuarioId
  if (params.accion) sp.accion = params.accion
  if (params.entidad) sp.entidad = params.entidad
  if (params.desde) sp.desde = params.desde
  if (params.hasta) sp.hasta = params.hasta
  if (params.q) sp.q = params.q
  return sp
}

export const auditoriaService = {
  // GET /api/auditoria — bitácora de acciones de usuario (requiere permiso
  // CONFIG_AUDITORIA nivel LECTURA). Aislada por empresa activa en el backend.
  async list(params: AuditoriaListParams = {}): Promise<AuditoriaListResponse> {
    return api.get('auditoria', { searchParams: buildSearchParams(params) }).json()
  },

  // GET /api/auditoria/facetas — usuarios/entidades para los filtros (mismo
  // permiso CONFIG_AUDITORIA; no depende del mantenedor de Usuarios).
  async facetas(): Promise<AuditoriaFacetas> {
    return api.get('auditoria/facetas').json()
  },

  // GET /api/auditoria/export — descarga CSV respetando los filtros aplicados.
  // Conserva las cabeceras de truncado para avisar si el CSV quedó incompleto.
  async exportCsv(params: AuditoriaListParams = {}): Promise<{ blob: Blob; total: number; truncado: boolean }> {
    const sp = buildSearchParams(params)
    delete sp.page
    delete sp.limit
    const res = await api.get('auditoria/export', { searchParams: sp })
    const truncado = res.headers.get('X-Truncado') === 'true'
    const total = Number(res.headers.get('X-Total-Registros') ?? '0')
    const blob = await res.blob()
    return { blob, total, truncado }
  },
}
