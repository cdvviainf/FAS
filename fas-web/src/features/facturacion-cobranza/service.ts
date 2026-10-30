import { api } from '@/lib/api'
import type {
  AplicarSaldoInput,
  CarteraResumenResponse,
  ClienteOption,
  CrearPagoInput,
  DocumentoPendiente,
  MonedaRef,
  Pago,
  PagosListResponse,
  SaldoAFavor,
} from './types'

// Fecha de HOY como "YYYY-MM-DD" en hora local (misma lógica que exportación).
export function hoyFecha(): string {
  const d = new Date()
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

export const cobranzaService = {
  async documentosPendientes(clienteId: number, monedaId?: number): Promise<{ data: DocumentoPendiente[] }> {
    const searchParams = monedaId ? { monedaId: String(monedaId) } : undefined
    return api.get(`ventas/cobranza/clientes/${clienteId}/documentos-pendientes`, { searchParams }).json()
  },
  async saldosAFavor(clienteId: number): Promise<{ data: SaldoAFavor[] }> {
    return api.get(`ventas/cobranza/clientes/${clienteId}/saldo-a-favor`).json()
  },
  async crearPago(body: CrearPagoInput): Promise<{ data: Pago }> {
    return api.post('ventas/cobranza/pagos', { json: body }).json()
  },
  async listPagos(filters: { clienteId?: number; page?: number; limit?: number } = {}): Promise<PagosListResponse> {
    const sp: Record<string, string> = {}
    if (filters.clienteId) sp.clienteId = String(filters.clienteId)
    if (filters.page) sp.page = String(filters.page)
    if (filters.limit) sp.limit = String(filters.limit)
    return api.get('ventas/cobranza/pagos', { searchParams: sp }).json()
  },
  async aplicarSaldo(saldoId: number, body: AplicarSaldoInput): Promise<{ data: unknown }> {
    return api.post(`ventas/cobranza/saldo-a-favor/${saldoId}/aplicar`, { json: body }).json()
  },
  // Cartera por cliente (landing): facturado/pagado/pendiente/vencido en USD.
  async carteraResumen(): Promise<CarteraResumenResponse> {
    return api.get('ventas/cobranza/clientes/cartera-resumen').json()
  },
  // Clientes para el selector — endpoint propio de Cobranza (bajo VENTAS_COBRANZA,
  // no exige CONFIG_ENTIDADES).
  async listClientes(): Promise<ClienteOption[]> {
    const resp = await api.get('ventas/cobranza/clientes').json<{ data: ClienteOption[] }>()
    return resp.data
  },
  // Monedas para el selector — endpoint propio de Cobranza (bajo VENTAS_COBRANZA).
  async listMonedas(): Promise<MonedaRef[]> {
    const resp = await api.get('ventas/cobranza/monedas').json<{ data: MonedaRef[] }>()
    return resp.data
  },
}
