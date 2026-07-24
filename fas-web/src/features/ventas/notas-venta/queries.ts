import { queryOptions } from '@tanstack/react-query'
import { notasVentaService } from './service'

export const notasVentaKeys = {
  all: ['notas-venta'] as const,
  list: (filters: object) => ['notas-venta', 'list', filters] as const,
  detail: (id: number) => ['notas-venta', 'detail', id] as const,
}

export function notasVentaListOptions(filters: { page?: number; limit?: number; clienteId?: number } = {}) {
  return queryOptions({
    queryKey: notasVentaKeys.list(filters),
    queryFn: () => notasVentaService.list(filters),
    staleTime: 30_000,
  })
}

export function notaVentaDetailOptions(id: number) {
  return queryOptions({
    queryKey: notasVentaKeys.detail(id),
    queryFn: () => notasVentaService.getById(id),
    staleTime: 30_000,
    enabled: id > 0,
  })
}
