import { queryOptions } from '@tanstack/react-query'
import { recepcionesService } from './service'
import type { OrigenRecepcion, EstadoRecepcion } from './types'

export const recepcionesKeys = {
  all: ['recepciones'] as const,
  list: (filters: object) => ['recepciones', 'list', filters] as const,
  detail: (id: number) => ['recepciones', 'detail', id] as const,
}

export function recepcionesListOptions(filters: { page?: number; limit?: number; plantaId?: number; origen?: OrigenRecepcion; estado?: EstadoRecepcion } = {}) {
  return queryOptions({
    queryKey: recepcionesKeys.list(filters),
    queryFn: () => recepcionesService.list(filters),
    staleTime: 30_000,
  })
}

export function recepcionDetailOptions(id: number) {
  return queryOptions({
    queryKey: recepcionesKeys.detail(id),
    queryFn: () => recepcionesService.getById(id),
    staleTime: 30_000,
    enabled: id > 0,
  })
}
