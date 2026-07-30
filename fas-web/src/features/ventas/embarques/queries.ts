import { queryOptions } from '@tanstack/react-query'
import { embarquesService } from './service'

export const embarquesKeys = {
  all: ['embarques'] as const,
  list: (filters: object) => ['embarques', 'list', filters] as const,
  detail: (id: number) => ['embarques', 'detail', id] as const,
}

export function embarquesListOptions(filters: { notaVentaId?: number } = {}) {
  return queryOptions({
    queryKey: embarquesKeys.list(filters),
    queryFn: () => embarquesService.list(filters),
    staleTime: 30_000,
    enabled: !!filters.notaVentaId,
  })
}

export function embarqueDetailOptions(id: number) {
  return queryOptions({
    queryKey: embarquesKeys.detail(id),
    queryFn: () => embarquesService.getById(id),
    staleTime: 30_000,
    enabled: id > 0,
  })
}
