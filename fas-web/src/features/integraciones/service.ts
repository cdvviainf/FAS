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

// El módulo Integraciones vive bajo /api/config (config.routes.ts registra
// integracionesRoutes sin prefijo propio) — todas las rutas necesitan el
// segmento "config/" explícito, igual que el resto de los mantenedores
// (perfiles, empresas, condiciones-pago...). Faltaba en las 8 llamadas de
// abajo desde que se creó este archivo: cualquier acción de este módulo
// devolvía 404 (detectado 2026-09-07 probando contra Coolify).
export const integracionesService = {
  async list(filters: IntegracionListFilters = {}): Promise<IntegracionListResponse> {
    const sp: Record<string, string> = {}
    if (filters.page) sp.page = String(filters.page)
    if (filters.limit) sp.limit = String(filters.limit)
    return api.get('config/integraciones', { searchParams: sp }).json()
  },
  async getById(id: number): Promise<{ data: Integracion }> {
    return api.get(`config/integraciones/${id}`).json()
  },
  async create(data: IntegracionCreateInput): Promise<{ data: Integracion }> {
    return api.post('config/integraciones', { json: data }).json()
  },
  async update(id: number, data: IntegracionUpdateInput): Promise<{ data: Integracion }> {
    return api.patch(`config/integraciones/${id}`, { json: data }).json()
  },
  async remove(id: number): Promise<void> {
    await api.delete(`config/integraciones/${id}`)
  },
  async addParametro(integracionId: number, data: IntegracionParametroInput): Promise<{ data: IntegracionParametro }> {
    return api.post(`config/integraciones/${integracionId}/parametros`, { json: data }).json()
  },
  async updateParametro(integracionId: number, parametroId: number, data: IntegracionParametroUpdateInput): Promise<{ data: IntegracionParametro }> {
    return api.patch(`config/integraciones/${integracionId}/parametros/${parametroId}`, { json: data }).json()
  },
  async removeParametro(integracionId: number, parametroId: number): Promise<void> {
    await api.delete(`config/integraciones/${integracionId}/parametros/${parametroId}`)
  },
  async listOpcionesMaestro(maestro: MaestroIntegracion): Promise<{ data: OpcionMaestro[] }> {
    return api.get(`config/integraciones/maestros/${maestro}`).json()
  },
}
