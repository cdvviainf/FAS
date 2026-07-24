import { queryOptions } from '@tanstack/react-query'
import { ordenesCompraService } from './service'
import type { EstadoOrdenCompra } from './types'

export const ordenesCompraKeys = {
  all: ['ordenes-compra'] as const,
  list: (filters: object) => ['ordenes-compra', 'list', filters] as const,
  detail: (id: number) => ['ordenes-compra', 'detail', id] as const,
}

export function ordenesCompraListOptions(filters: { page?: number; limit?: number; entidadProductorId?: number; estado?: EstadoOrdenCompra } = {}) {
  return queryOptions({
    queryKey: ordenesCompraKeys.list(filters),
    queryFn: () => ordenesCompraService.list(filters),
    staleTime: 30_000,
  })
}

export function ordenCompraDetailOptions(id: number) {
  return queryOptions({
    queryKey: ordenesCompraKeys.detail(id),
    queryFn: () => ordenesCompraService.getById(id),
    staleTime: 30_000,
    enabled: id > 0,
  })
}
