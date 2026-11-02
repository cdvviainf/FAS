import { queryOptions } from '@tanstack/react-query'
import { proformasProductorService } from './service'
import type { ProformaProductorListFilters } from './types'

export const proformasProductorKeys = {
  all: ['proformas-productor'] as const,
  list: (filters: object) => ['proformas-productor', 'list', filters] as const,
  detail: (id: number) => ['proformas-productor', 'detail', id] as const,
}

export function proformasProductorListOptions(filters: ProformaProductorListFilters = {}) {
  return queryOptions({
    queryKey: proformasProductorKeys.list(filters),
    queryFn: () => proformasProductorService.list(filters),
    staleTime: 30_000,
  })
}

export function proformaProductorDetailOptions(id: number) {
  return queryOptions({
    queryKey: proformasProductorKeys.detail(id),
    queryFn: () => proformasProductorService.getById(id),
    staleTime: 30_000,
    enabled: id > 0,
  })
}
