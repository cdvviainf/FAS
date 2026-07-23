import { queryOptions } from '@tanstack/react-query'
import { tiposMovimientoService } from './service'
import type { TipoMovimientoListFilters } from './types'

export const tiposMovimientoKeys = {
  all: ['tipos-movimiento'] as const,
  list: (filters: object) => ['tipos-movimiento', 'list', filters] as const,
}

export function tiposMovimientoListOptions(filters: TipoMovimientoListFilters = {}) {
  return queryOptions({
    queryKey: tiposMovimientoKeys.list(filters),
    queryFn: () => tiposMovimientoService.list(filters),
    staleTime: 15_000,
  })
}
