import { queryOptions } from '@tanstack/react-query'
import { cobranzaService } from './service'

export const cobranzaKeys = {
  all: ['cobranza'] as const,
  documentos: (clienteId: number, monedaId?: number) => ['cobranza', 'documentos', clienteId, monedaId ?? null] as const,
  saldos: (clienteId: number) => ['cobranza', 'saldos', clienteId] as const,
  pagos: (filters: object) => ['cobranza', 'pagos', filters] as const,
  clientes: ['cobranza', 'clientes'] as const,
  monedas: ['cobranza', 'monedas'] as const,
  carteraResumen: ['cobranza', 'cartera-resumen'] as const,
}

export function carteraResumenOptions() {
  return queryOptions({
    queryKey: cobranzaKeys.carteraResumen,
    queryFn: () => cobranzaService.carteraResumen(),
    staleTime: 30_000,
  })
}

export function documentosPendientesOptions(clienteId: number, monedaId?: number) {
  return queryOptions({
    queryKey: cobranzaKeys.documentos(clienteId, monedaId),
    queryFn: () => cobranzaService.documentosPendientes(clienteId, monedaId),
    enabled: clienteId > 0,
    staleTime: 10_000,
  })
}

export function saldosAFavorOptions(clienteId: number) {
  return queryOptions({
    queryKey: cobranzaKeys.saldos(clienteId),
    queryFn: () => cobranzaService.saldosAFavor(clienteId),
    enabled: clienteId > 0,
    staleTime: 10_000,
  })
}

export function pagosListOptions(filters: { clienteId?: number; page?: number; limit?: number } = {}) {
  return queryOptions({
    queryKey: cobranzaKeys.pagos(filters),
    queryFn: () => cobranzaService.listPagos(filters),
    enabled: (filters.clienteId ?? 0) > 0,
    staleTime: 10_000,
  })
}

export function clientesOptions() {
  return queryOptions({
    queryKey: cobranzaKeys.clientes,
    queryFn: () => cobranzaService.listClientes(),
    staleTime: 60_000,
  })
}

export function monedasOptions() {
  return queryOptions({
    queryKey: cobranzaKeys.monedas,
    queryFn: () => cobranzaService.listMonedas(),
    staleTime: 60_000,
  })
}
