import { api } from '@/lib/api'
import type {
  FacturaNacional,
  FacturaNacionalActualizarInput,
  FacturasNacionalListFilters,
  FacturasNacionalListResponse,
  ProformasFacturablesResponse,
  EmbarquesFacturablesResponse,
  OperacionesNacionalFilters,
  OperacionesNacionalResponse,
  TipoCambioSugerido,
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
  async listEmbarquesFacturables(filters: { page?: number; limit?: number; q?: string } = {}): Promise<EmbarquesFacturablesResponse> {
    const sp: Record<string, string> = {}
    if (filters.page) sp.page = String(filters.page)
    if (filters.limit) sp.limit = String(filters.limit)
    if (filters.q?.trim()) sp.q = filters.q.trim()
    return api.get('ventas/cobranza/facturas-nacional/embarques-facturables', { searchParams: sp }).json()
  },
  // Listado unificado de operaciones (venta/proforma) con su estado de factura.
  async listOperaciones(filters: OperacionesNacionalFilters = {}): Promise<OperacionesNacionalResponse> {
    const sp: Record<string, string> = {}
    if (filters.page) sp.page = String(filters.page)
    if (filters.limit) sp.limit = String(filters.limit)
    if (filters.q?.trim()) sp.q = filters.q.trim()
    if (filters.origen) sp.origen = filters.origen
    if (filters.estado) sp.estado = filters.estado
    return api.get('ventas/cobranza/facturas-nacional/operaciones', { searchParams: sp }).json()
  },
  async obtenerPorId(id: number): Promise<{ data: FacturaNacional }> {
    return api.get(`ventas/cobranza/facturas-nacional/${id}`).json()
  },
  async crearDesdeProforma(proformaMaterialId: number): Promise<{ data: FacturaNacional }> {
    return api.post('ventas/cobranza/facturas-nacional', { json: { proformaMaterialId } }).json()
  },
  async crearDesdeEmbarque(embarqueId: number): Promise<{ data: FacturaNacional }> {
    return api.post(`ventas/cobranza/facturas-nacional/desde-embarque/${embarqueId}`).json()
  },
  // Tipo de cambio sugerido (moneda de origen → CLP) para una factura de venta;
  // fecha (YYYY-MM-DD) opcional = paridad de esa fecha.
  async obtenerTipoCambio(id: number, fecha?: string): Promise<{ data: TipoCambioSugerido }> {
    const searchParams = fecha ? { fecha } : undefined
    return api.get(`ventas/cobranza/facturas-nacional/${id}/tipo-cambio`, { searchParams }).json()
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
  // Reconcilia el estado con el veredicto real del SII (ENVIADA_SII → APROBADA/RECHAZADA).
  async consultarSii(id: number): Promise<{ data: { factura: FacturaNacional; sii: { veredicto: 'ACEPTADO' | 'RECHAZADO' | 'PENDIENTE'; glosa: string } } }> {
    return api.post(`ventas/cobranza/facturas-nacional/${id}/consultar-sii`).json()
  },
  async anular(id: number): Promise<{ data: FacturaNacional }> {
    return api.post(`ventas/cobranza/facturas-nacional/${id}/anular`).json()
  },
  // Anula una Factura APROBADA emitiendo una Nota de Crédito nacional (DTE 61).
  async anularConNc(id: number): Promise<{ data: { id: number; codigo: string; folio: number | null } }> {
    return api.post(`ventas/cobranza/facturas-nacional/${id}/anular-con-nc`).json()
  },
  async verPdfNc(ncId: number): Promise<void> {
    const blob = await api.get(`ventas/cobranza/notas-credito/${ncId}/pdf`).blob()
    window.open(URL.createObjectURL(blob), '_blank', 'noopener,noreferrer')
  },
  async descargarXmlNc(ncId: number, nombreArchivo: string): Promise<void> {
    const blob = await api.get(`ventas/cobranza/notas-credito/${ncId}/xml`).blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = nombreArchivo
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
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
