import { queryOptions } from '@tanstack/react-query'
import { articulosService } from './service'
import type { ArticuloListFilters } from './types'

export const articulosKeys = {
  all: ['materiales-articulos'] as const,
  list: (filters: object) => ['materiales-articulos', 'list', filters] as const,
  detail: (id: number) => ['materiales-articulos', 'detail', id] as const,
  documentos: (id: number) => ['materiales-articulos', 'documentos', id] as const,
}

export function articulosListOptions(filters: ArticuloListFilters = {}) {
  return queryOptions({
    queryKey: articulosKeys.list(filters),
    queryFn: () => articulosService.list(filters),
    staleTime: 15_000,
  })
}

export function articuloDetailOptions(id: number) {
  return queryOptions({
    queryKey: articulosKeys.detail(id),
    queryFn: () => articulosService.getById(id),
    staleTime: 15_000,
    enabled: id > 0,
  })
}
