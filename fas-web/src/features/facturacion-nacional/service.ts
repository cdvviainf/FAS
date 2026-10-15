import { api } from '@/lib/api'
import type {
  FacturaNacional,
  FacturaNacionalActualizarInput,
  FacturasNacionalListFilters,
  FacturasNacionalListResponse,
  ProformasFacturablesResponse,
} from './types'

// Fecha de HOY como "YYYY-MM-DD" en hora local (para sugerir la fecha del
// documento) — no usa UTC para no adelantar/atrasar el día de noche.
export function hoyFecha(): string {
  const d = new Date()
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

export const facturaNacionalService = {
  async list(filters: FacturasNacionalListFilters = {}): Promise<FacturasNacionalListResponse> {
    const sp: Record<string, string> = {}
    if (filters.page) sp.page = String(filters.page)
    if (filters.limit) sp.limit = String(filters.limit)
    if (filters.estado) sp.estado = filters.estado
    if (filters.q?.trim()) sp.q = filters.q.trim()
    return api.get('ventas/cobranza/facturas-nacional', { searchParams: sp }).json()
  },
  async listProformasFacturables(filters: { page?: number; limit?: number; q?: string } = {}): Promise<ProformasFacturablesResponse> {
    const sp: Record<string, string> = {}
    if (filters.page) sp.page = String(filters.page)
    if (filters.limit) sp.limit = String(filters.limit)
    if (filters.q?.trim()) sp.q = filters.q.trim()
    return api.get('ventas/cobranza/facturas-nacional/proformas-facturables', { searchParams: sp }).json()
  },
  async obtenerPorId(id: number): Promise<{ data: FacturaNacional }> {
    return api.get(`ventas/cobranza/facturas-nacional/${id}`).json()
  },
  async crearDesdeProforma(proformaMaterialId: number): Promise<{ data: FacturaNacional }> {
    return api.post('ventas/cobranza/facturas-nacional', { json: { proformaMaterialId } }).json()
  },
  async actualizar(id: number, body: FacturaNacionalActualizarInput): Promise<{ data: FacturaNacional }> {
    return api.patch(`ventas/cobranza/facturas-nacional/${id}`, { json: body }).json()
  },
  async enviarSii(id: number): Promise<{ data: FacturaNacional }> {
    return api.post(`ventas/cobranza/facturas-nacional/${id}/enviar-sii`).json()
  },
  async firmar(id: number): Promise<{ data: FacturaNacional }> {
    return api.post(`ventas/cobranza/facturas-nacional/${id}/firmar`).json()
  },
  async reabrir(id: number): Promise<{ data: FacturaNacional }> {
    return api.post(`ventas/cobranza/facturas-nacional/${id}/reabrir`).json()
  },
  async anular(id: number): Promise<{ data: FacturaNacional }> {
    return api.post(`ventas/cobranza/facturas-nacional/${id}/anular`).json()
  },
  // Rescata el PDF del borrador (DTE temporal) desde LibreDTE y lo abre en una
  // pestaña nueva. Requiere haber enviado el borrador al SII.
  async verPdfBorrador(id: number): Promise<void> {
    const blob = await api.get(`ventas/cobranza/facturas-nacional/${id}/pdf-borrador`).blob()
    window.open(URL.createObjectURL(blob), '_blank', 'noopener,noreferrer')
  },
  // Descarga el XML timbrado, disparando la descarga en el navegador.
  async descargarXml(id: number, nombreArchivo: string): Promise<void> {
    const blob = await api.get(`ventas/cobranza/facturas-nacional/${id}/xml`).blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = nombreArchivo
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  },
}
