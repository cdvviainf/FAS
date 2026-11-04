import { queryOptions } from '@tanstack/react-query'
import { generadorDteService } from './service'
import type { DocumentoManualListFilters } from './types'

export const generadorDteKeys = {
  all: ['generador-dte'] as const,
  list: (filters: object) => ['generador-dte', 'list', filters] as const,
  detail: (id: number) => ['generador-dte', 'detail', id] as const,
}

export function generadorDteListOptions(filters: DocumentoManualListFilters = {}) {
  return queryOptions({
    queryKey: generadorDteKeys.list(filters),
    queryFn: () => generadorDteService.list(filters),
    staleTime: 30_000,
  })
}

export function generadorDteDetailOptions(id: number) {
  return queryOptions({
    queryKey: generadorDteKeys.detail(id),
    queryFn: () => generadorDteService.getById(id),
    staleTime: 30_000,
    enabled: id > 0,
  })
}
