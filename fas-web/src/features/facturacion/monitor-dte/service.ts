import { api } from '@/lib/api'
import type { EstadoSiiDte, MonitorDteFiltros, MonitorDteListResponse } from './types'

export const monitorDteService = {
  async list(f: MonitorDteFiltros = {}): Promise<MonitorDteListResponse> {
    const sp: Record<string, string> = {}
    if (f.page) sp.page = String(f.page)
    if (f.limit) sp.limit = String(f.limit)
    if (f.tipoDte) sp.tipoDte = String(f.tipoDte)
    if (f.estadoSii) sp.estadoSii = f.estadoSii
    if (f.fechaDesde) sp.fechaDesde = f.fechaDesde
    if (f.fechaHasta) sp.fechaHasta = f.fechaHasta
    if (f.folio) sp.folio = String(f.folio)
    if (f.receptor?.trim()) sp.receptor = f.receptor.trim()
    return api.get('monitor-dte', { searchParams: sp }).json()
  },
  async consultarSii(id: number): Promise<{ data: { id: number; sii: { veredicto: EstadoSiiDte; glosa: string } } }> {
    return api.post(`monitor-dte/${id}/consultar-sii`).json()
  },
  // PDF timbrado (LibreDTE) en pestaña nueva.
  async verPdf(id: number): Promise<void> {
    const blob = await api.get(`monitor-dte/${id}/pdf`).blob()
    window.open(URL.createObjectURL(blob), '_blank', 'noopener,noreferrer')
  },
  async descargarXml(id: number, nombreArchivo: string): Promise<void> {
    const blob = await api.get(`monitor-dte/${id}/xml`).blob()
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

export const monitorDteKeys = {
  all: ['monitor-dte'] as const,
  list: (f: MonitorDteFiltros) => ['monitor-dte', 'list', f] as const,
}
