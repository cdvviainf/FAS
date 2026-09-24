import { api } from '@/lib/api'
import type {
  DimensionProforma,
  FacturaExportacion,
  FacturaExportacionActualizarInput,
  FacturasExportacionListFilters,
  FacturasExportacionListResponse,
  Proforma,
  ProformaEmitirInput,
  ProformaLineaSugerida,
  ProformasListFilters,
  ProformasListResponse,
} from './types'

export const proformaService = {
  async sugerirLineas(embarqueId: number, dimensiones: DimensionProforma[]): Promise<{ data: ProformaLineaSugerida[] }> {
    const searchParams: Record<string, string> = {}
    if (dimensiones.length > 0) searchParams.dimensiones = dimensiones.join(',')
    return api.get(`ventas/cobranza/embarques/${embarqueId}/proforma/sugerencia`, { searchParams }).json()
  },
  async obtenerPorEmbarque(embarqueId: number): Promise<{ data: Proforma | null }> {
    return api.get(`ventas/cobranza/embarques/${embarqueId}/proforma`).json()
  },
  async obtenerPorId(id: number): Promise<{ data: Proforma }> {
    return api.get(`ventas/cobranza/proformas/${id}`).json()
  },
  async emitir(embarqueId: number, body: ProformaEmitirInput): Promise<{ data: Proforma }> {
    return api.post(`ventas/cobranza/embarques/${embarqueId}/proforma`, { json: body }).json()
  },
  async list(filters: ProformasListFilters = {}): Promise<ProformasListResponse> {
    const sp: Record<string, string> = {}
    if (filters.page) sp.page = String(filters.page)
    if (filters.limit) sp.limit = String(filters.limit)
    if (filters.embarqueId) sp.embarqueId = String(filters.embarqueId)
    if (filters.clienteId) sp.clienteId = String(filters.clienteId)
    if (filters.estado) sp.estado = filters.estado
    if (filters.folio) sp.folio = filters.folio
    return api.get('ventas/cobranza/proformas', { searchParams: sp }).json()
  },
  async anular(id: number): Promise<{ data: Proforma }> {
    return api.post(`ventas/cobranza/proformas/${id}/anular`).json()
  },
}

export const facturaExportacionService = {
  async crearDesdeProforma(proformaId: number): Promise<{ data: FacturaExportacion }> {
    return api.post(`ventas/cobranza/proformas/${proformaId}/factura-exportacion`).json()
  },
  async obtenerPorId(id: number): Promise<{ data: FacturaExportacion }> {
    return api.get(`ventas/cobranza/facturas-exportacion/${id}`).json()
  },
  async obtenerPorEmbarque(embarqueId: number): Promise<{ data: FacturaExportacion | null }> {
    return api.get(`ventas/cobranza/embarques/${embarqueId}/factura-exportacion`).json()
  },
  async actualizar(id: number, body: FacturaExportacionActualizarInput): Promise<{ data: FacturaExportacion }> {
    return api.patch(`ventas/cobranza/facturas-exportacion/${id}`, { json: body }).json()
  },
  async emitir(id: number): Promise<{ data: FacturaExportacion }> {
    return api.post(`ventas/cobranza/facturas-exportacion/${id}/emitir`).json()
  },
  async anular(id: number): Promise<{ data: FacturaExportacion }> {
    return api.post(`ventas/cobranza/facturas-exportacion/${id}/anular`).json()
  },
  async list(filters: FacturasExportacionListFilters = {}): Promise<FacturasExportacionListResponse> {
    const sp: Record<string, string> = {}
    if (filters.page) sp.page = String(filters.page)
    if (filters.limit) sp.limit = String(filters.limit)
    if (filters.embarqueId) sp.embarqueId = String(filters.embarqueId)
    if (filters.clienteId) sp.clienteId = String(filters.clienteId)
    if (filters.estado) sp.estado = filters.estado
    if (filters.folio) sp.folio = filters.folio
    return api.get('ventas/cobranza/facturas-exportacion', { searchParams: sp }).json()
  },
}
