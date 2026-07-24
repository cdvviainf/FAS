import { queryOptions } from '@tanstack/react-query'
import { instructivoEmbalajeService } from './service'

export const instructivosEmbalajeKeys = {
  all: ['instructivos-embalaje'] as const,
  list: (filters: object) => ['instructivos-embalaje', 'list', filters] as const,
  detail: (id: number) => ['instructivos-embalaje', 'detail', id] as const,
}

export function instructivosEmbalajeListOptions(filters: { page?: number; limit?: number; notaVentaId?: number } = {}) {
  return queryOptions({
    queryKey: instructivosEmbalajeKeys.list(filters),
    queryFn: () => instructivoEmbalajeService.list(filters),
    staleTime: 30_000,
  })
}

export function instructivoEmbalajeDetailOptions(id: number) {
  return queryOptions({
    queryKey: instructivosEmbalajeKeys.detail(id),
    queryFn: () => instructivoEmbalajeService.getById(id),
    staleTime: 30_000,
    enabled: id > 0,
  })
}
