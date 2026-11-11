import { api } from '@/lib/api'
import type { GrupoDespachado, SolicitudPago, SolicitudPagoLineaInput, SolicitudPagoListResponse, EstadoSolicitudPago } from './types'

const BASE = 'productores/solicitudes-pago'

export const solicitudesPagoService = {
  async despachado(params: { entidadProductorId: number; temporadaId: number; excluirSolicitudId?: number }): Promise<{ data: GrupoDespachado[] }> {
    const sp: Record<string, string> = { entidadProductorId: String(params.entidadProductorId), temporadaId: String(params.temporadaId) }
    if (params.excluirSolicitudId) sp.excluirSolicitudId = String(params.excluirSolicitudId)
    return api.get(`${BASE}/despachado`, { searchParams: sp }).json()
  },
  async pendientes(params: { temporadaId: number; entidadProductorId?: number }): Promise<{ data: GrupoDespachado[] }> {
    const sp: Record<string, string> = { temporadaId: String(params.temporadaId) }
    if (params.entidadProductorId) sp.entidadProductorId = String(params.entidadProductorId)
    return api.get(`${BASE}/pendientes`, { searchParams: sp }).json()
  },
  async list(params: { page?: number; limit?: number; q?: string; estado?: EstadoSolicitudPago } = {}): Promise<SolicitudPagoListResponse> {
    const sp: Record<string, string> = {}
    if (params.page) sp.page = String(params.page)
    if (params.limit) sp.limit = String(params.limit)
    if (params.q?.trim()) sp.q = params.q.trim()
    if (params.estado) sp.estado = params.estado
    return api.get(BASE, { searchParams: sp }).json()
  },
  async getById(id: number): Promise<{ data: SolicitudPago }> {
    return api.get(`${BASE}/${id}`).json()
  },
  async create(data: { entidadProductorId: number; temporadaId: number | null; observaciones: string | null; lineas: SolicitudPagoLineaInput[] }): Promise<{ data: SolicitudPago }> {
    return api.post(BASE, { json: data }).json()
  },
  async update(id: number, data: { observaciones: string | null; lineas: SolicitudPagoLineaInput[] }): Promise<{ data: SolicitudPago }> {
    return api.put(`${BASE}/${id}`, { json: data }).json()
  },
  async confirmarPago(
    id: number,
    data: { fechaPago: string; conceptoCtaCteId: number; numeroTransferencia: string | null; facturas: { lineaId: number; numeroFactura: string }[] },
  ): Promise<{ data: SolicitudPago }> {
    return api.post(`${BASE}/${id}/confirmar-pago`, { json: data }).json()
  },
  async anular(id: number): Promise<{ data: SolicitudPago }> {
    return api.post(`${BASE}/${id}/anular`).json()
  },
}

export const solicitudesPagoKeys = {
  all: ['solicitudes-pago'] as const,
  list: (p: object) => ['solicitudes-pago', 'list', p] as const,
  pendientes: (temporadaId: number) => ['solicitudes-pago', 'pendientes', temporadaId] as const,
  detalle: (id: number) => ['solicitudes-pago', 'detalle', id] as const,
  despachado: (productorId: number, temporadaId: number, excluir?: number) => ['solicitudes-pago', 'despachado', productorId, temporadaId, excluir ?? null] as const,
}
