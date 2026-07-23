import { queryOptions } from '@tanstack/react-query'
import { solicitudesService } from './service'
import type { SolicitudListFilters } from './types'

export const solicitudesKeys = {
  all: ['solicitudes-inspeccion'] as const,
  list: (filters: object) => ['solicitudes-inspeccion', 'list', filters] as const,
  detail: (id: number) => ['solicitudes-inspeccion', 'detail', id] as const,
}

export function solicitudesListOptions(filters: SolicitudListFilters = {}) {
  return queryOptions({
    queryKey: solicitudesKeys.list(filters),
    queryFn: () => solicitudesService.list(filters),
    staleTime: 15_000,
  })
}

export function solicitudDetailOptions(id: number) {
  return queryOptions({
    queryKey: solicitudesKeys.detail(id),
    queryFn: () => solicitudesService.getById(id),
    staleTime: 15_000,
    enabled: id > 0,
  })
}
