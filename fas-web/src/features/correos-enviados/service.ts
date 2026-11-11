import { api } from '@/lib/api'

export type EstadoCorreo = 'PENDIENTE' | 'ENVIADO' | 'FALLIDO'

export const ESTADO_CORREO_LABELS: Record<EstadoCorreo, string> = {
  PENDIENTE: 'Pendiente',
  ENVIADO: 'Enviado',
  FALLIDO: 'Fallido',
}

export interface CorreoEnviado {
  id: number
  lote: string
  destinatario: string
  asunto: string
  origen: string | null
  pdfTipo: string | null
  estado: EstadoCorreo
  intentos: number
  ultimoError: string | null
  enviadoEn: string | null
  reintentadoEn: string | null
  reintentadoPor: string | null
  creadoEn: string
  html?: string
}

export interface CorreosFiltros {
  page?: number
  limit?: number
  estado?: EstadoCorreo
  q?: string
  desde?: string
  hasta?: string
}

export const correosEnviadosService = {
  async list(f: CorreosFiltros): Promise<{ data: CorreoEnviado[]; meta: { total: number; page: number; limit: number; totalPages: number } }> {
    const sp: Record<string, string> = {}
    for (const [k, v] of Object.entries(f)) if (v != null && v !== '') sp[k] = String(v)
    return api.get('correos-enviados', { searchParams: sp }).json()
  },
  async getById(id: number): Promise<{ data: CorreoEnviado }> {
    return api.get(`correos-enviados/${id}`).json()
  },
  async reintentar(id: number): Promise<{ data: CorreoEnviado }> {
    return api.post(`correos-enviados/${id}/reintentar`).json()
  },
}
