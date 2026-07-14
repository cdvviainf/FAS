import { queryOptions } from '@tanstack/react-query'
import { createMantenedorService } from './service'
import type { MantenedorSimpleFilters } from './types'

export function createMantenedorQueries(recurso: string) {
  const svc = createMantenedorService(recurso)
  const keys = {
    all: [recurso] as const,
    list: (f: MantenedorSimpleFilters) => [recurso, 'list', f] as const,
    detail: (id: number) => [recurso, 'detail', id] as const
  }

  return {
    keys,
    listOptions: (filters: MantenedorSimpleFilters = {}) =>
      queryOptions({
        queryKey: keys.list(filters),
        queryFn: () => svc.list(filters),
        staleTime: 30_000
      }),
    service: svc
  }
}
