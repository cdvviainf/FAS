import { queryOptions } from '@tanstack/react-query'
import { reclamosService } from './service'
import type { ReclamosListFilters } from './types'

export const reclamosKeys = {
  all: ['reclamos'] as const,
  list: (filters: object) => ['reclamos', 'list', filters] as const,
  detail: (id: number) => ['reclamos', 'detail', id] as const,
  porEmbarque: (embarqueId: number) => ['reclamos', 'embarque', embarqueId] as const,
  lineasReclamables: (embarqueId: number) => ['reclamos', 'lineas-reclamables', embarqueId] as const,
  provisiones: (reclamoId: number) => ['reclamos', 'provisiones', reclamoId] as const,
}

export function reclamosListOptions(filters: ReclamosListFilters = {}) {
  return queryOptions({
    queryKey: reclamosKeys.list(filters),
    queryFn: () => reclamosService.list(filters),
    staleTime: 15_000,
  })
}

export function reclamoDetailOptions(id: number) {
  return queryOptions({
    queryKey: reclamosKeys.detail(id),
    queryFn: () => reclamosService.getById(id),
    staleTime: 10_000,
    enabled: id > 0,
  })
}

export function reclamosPorEmbarqueOptions(embarqueId: number) {
  return queryOptions({
    queryKey: reclamosKeys.porEmbarque(embarqueId),
    queryFn: () => reclamosService.listarPorEmbarque(embarqueId),
    staleTime: 15_000,
    enabled: embarqueId > 0,
  })
}

export function lineasReclamablesOptions(embarqueId: number) {
  return queryOptions({
    queryKey: reclamosKeys.lineasReclamables(embarqueId),
    queryFn: () => reclamosService.lineasReclamables(embarqueId),
    staleTime: 10_000,
    enabled: embarqueId > 0,
  })
}
