import { queryOptions } from '@tanstack/react-query'
import { recetasService } from './service'
import type { RecetaListFilters } from './types'

export const recetasKeys = {
  all: ['materiales-recetas'] as const,
  list: (filters: object) => ['materiales-recetas', 'list', filters] as const,
}

export function recetasListOptions(filters: RecetaListFilters = {}) {
  return queryOptions({
    queryKey: recetasKeys.list(filters),
    queryFn: () => recetasService.list(filters),
    staleTime: 15_000,
  })
}
