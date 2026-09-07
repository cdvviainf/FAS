import { queryOptions } from '@tanstack/react-query'
import { integracionesService } from './service'
import type { IntegracionListFilters, MaestroIntegracion } from './types'

export const integracionesKeys = {
  all: ['integraciones'] as const,
  list: (filters: object) => ['integraciones', 'list', filters] as const,
  detail: (id: number) => ['integraciones', 'detail', id] as const,
  opcionesMaestro: (maestro: MaestroIntegracion) => ['integraciones', 'opciones-maestro', maestro] as const,
}

export function integracionesListOptions(filters: IntegracionListFilters = {}) {
  return queryOptions({
    queryKey: integracionesKeys.list(filters),
    queryFn: () => integracionesService.list(filters),
    staleTime: 30_000,
  })
}

export function integracionDetailOptions(id: number) {
  return queryOptions({
    queryKey: integracionesKeys.detail(id),
    queryFn: () => integracionesService.getById(id),
    staleTime: 10_000,
    enabled: id > 0,
  })
}

export function opcionesMaestroOptions(maestro: MaestroIntegracion | null) {
  return queryOptions({
    queryKey: integracionesKeys.opcionesMaestro(maestro ?? 'ENTIDAD'),
    queryFn: () => integracionesService.listOpcionesMaestro(maestro!),
    staleTime: 60_000,
    enabled: !!maestro,
  })
}
