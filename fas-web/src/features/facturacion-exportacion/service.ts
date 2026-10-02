import { api } from '@/lib/api'

// Abre el Cierre Comercial de una Nota de Venta en una ventana emergente
// (popup), sin reemplazar la pantalla actual de Facturación.
export function abrirCierreComercial(notaVentaId: number) {
  window.open(`/dashboard/ventas/cierre/${notaVentaId}`, '_blank', 'width=1200,height=850,noopener,noreferrer')
}

// Fecha de HOY como "YYYY-MM-DD" en hora local (para sugerir la fecha del
// documento) — no usa UTC para no adelantar/atrasar el día de noche.
export function hoyFecha(): string {
  const d = new Date()
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}
import type {
  DimensionProforma,
  EmbarquesExportacionListResponse,
  FacturaExportacion,
  FacturaExportacionActualizarInput,
  FacturasExportacionListFilters,
  FacturasExportacionListResponse,
  Proforma,
  ProformaEmitirInput,
  ProformaSugerenciaResponse,
  ProformasListFilters,
  ProformasListResponse,
  TipoCambioSugerido,
} from './types'

export const proformaService = {
  async sugerirLineas(embarqueId: number, dimensiones: DimensionProforma[]): Promise<ProformaSugerenciaResponse> {
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
  async enviarSii(id: number): Promise<{ data: FacturaExportacion }> {
    return api.post(`ventas/cobranza/facturas-exportacion/${id}/enviar-sii`).json()
  },
  // Diagnóstico: payload exacto que se manda a simpleDTE + resumen de códigos
  // Aduana. No envía nada; sirve para ver por qué el PDF sale reducido.
  async previsualizarPayloadDte(id: number): Promise<{ data: { endpoint: string; aduanaResumen: Record<string, unknown>; payload: unknown } }> {
    return api.get(`ventas/cobranza/facturas-exportacion/${id}/payload-dte`).json()
  },
  // Rescata el PDF del borrador (DTE temporal) desde LibreDTE y lo abre en una
  // pestaña nueva. Requiere haber enviado el borrador al SII.
  async verPdfBorrador(id: number): Promise<void> {
    const blob = await api.get(`ventas/cobranza/facturas-exportacion/${id}/pdf-borrador`).blob()
    window.open(URL.createObjectURL(blob), '_blank', 'noopener,noreferrer')
  },
  async firmar(id: number): Promise<{ data: FacturaExportacion }> {
    return api.post(`ventas/cobranza/facturas-exportacion/${id}/firmar`).json()
  },
  async reabrir(id: number): Promise<{ data: FacturaExportacion }> {
    return api.post(`ventas/cobranza/facturas-exportacion/${id}/reabrir`).json()
  },
  async anular(id: number): Promise<{ data: FacturaExportacion }> {
    return api.post(`ventas/cobranza/facturas-exportacion/${id}/anular`).json()
  },
  // Descarga el XML timbrado (vía ky para adjuntar el contexto de empresa),
  // disparando la descarga en el navegador.
  async descargarXml(id: number, nombreArchivo: string): Promise<void> {
    const blob = await api.get(`ventas/cobranza/facturas-exportacion/${id}/xml`).blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = nombreArchivo
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  },
  // Tipo de cambio sugerido (dólar/euro observado del Banco Central) para la
  // moneda de la factura. No persiste: el valor se guarda al editar la factura.
  async obtenerTipoCambio(id: number): Promise<{ data: TipoCambioSugerido }> {
    return api.get(`ventas/cobranza/facturas-exportacion/${id}/tipo-cambio`).json()
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
  async listEmbarques(filters: { page?: number; limit?: number; folio?: string; clienteId?: number } = {}): Promise<EmbarquesExportacionListResponse> {
    const sp: Record<string, string> = {}
    if (filters.page) sp.page = String(filters.page)
    if (filters.limit) sp.limit = String(filters.limit)
    if (filters.folio) sp.folio = filters.folio
    if (filters.clienteId) sp.clienteId = String(filters.clienteId)
    return api.get('ventas/cobranza/exportacion/embarques-despachados', { searchParams: sp }).json()
  },
}
