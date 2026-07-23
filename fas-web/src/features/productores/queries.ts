import { queryOptions } from '@tanstack/react-query'
import { productoresService } from './service'

export const productoresKeys = {
  all: ['productores'] as const,
  list: (filters: object) => ['productores', 'list', filters] as const,
  ficha: (id: number) => ['productores', 'ficha', id] as const,
}

export function productoresListOptions(filters: { q?: string; page?: number; limit?: number } = {}) {
  return queryOptions({
    queryKey: productoresKeys.list(filters),
    queryFn: () => productoresService.list(filters),
    staleTime: 15_000,
  })
}

export function productorFichaOptions(id: number) {
  return queryOptions({
    queryKey: productoresKeys.ficha(id),
    queryFn: () => productoresService.getFicha(id),
    staleTime: 15_000,
    enabled: id > 0,
  })
}
