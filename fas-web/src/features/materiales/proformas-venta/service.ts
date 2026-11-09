import { api } from '@/lib/api'
import type {
  ProformaMaterialListResponse,
  ProformaMaterialDetalle,
  ProformaMaterialCreateInput,
  ProformaMaterialUpdateInput,
  ProformaMaterialLineaUpdateInput,
  ProformaMaterialLineaItem,
  ProformaMaterialListFilters,
  MovimientosRequierenProformaResponse,
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

  // Landing: Movimientos que requieren proforma + estado de emisión.
  async listMovimientos(params: { page?: number; limit?: number } = {}): Promise<MovimientosRequierenProformaResponse> {
    const sp: Record<string, string> = {}
    if (params.page) sp.page = String(params.page)
    if (params.limit) sp.limit = String(params.limit)
    return api.get('materiales/proformas/movimientos', { searchParams: sp }).json()
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

  // Tipo de cambio sugerido (CLP por 1 unidad) — fuentes configuradas en
  // Integraciones (TC_*), con respaldo local. Para el botón "Obtener".
  async obtenerTipoCambio(moneda: string, fecha?: string): Promise<{ data: { valor: number; fecha: string | null; moneda: string; fuente: string | null } }> {
    const sp: Record<string, string> = { moneda }
    if (fecha) sp.fecha = fecha
    return api.get('materiales/proformas/tipo-cambio', { searchParams: sp }).json()
  },

  async anular(id: number): Promise<{ data: ProformaMaterialDetalle }> {
    return api.post(`materiales/proformas/${id}/anular`).json()
  },
}
