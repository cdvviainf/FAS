import { queryOptions } from '@tanstack/react-query'
import { movimientosService } from './service'
import type { MovimientoListFilters } from './types'

export const movimientosKeys = {
  all: ['movimientos'] as const,
  list: (filters: object) => ['movimientos', 'list', filters] as const,
}

export function movimientosListOptions(filters: MovimientoListFilters = {}) {
  return queryOptions({
    queryKey: movimientosKeys.list(filters),
    queryFn: () => movimientosService.list(filters),
    staleTime: 10_000,
  })
}
