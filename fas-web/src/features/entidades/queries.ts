import { queryOptions } from '@tanstack/react-query'
import { entidadesService } from './service'
import type { TipoEntidad } from './types'

export const entidadesKeys = {
  all: ['entidades'] as const,
  list: (filters: object) => ['entidades', 'list', filters] as const,
  detail: (id: number) => ['entidades', 'detail', id] as const,
  paises: ['paises'] as const,
  comunas: ['comunas'] as const,
}

export function entidadesListOptions(filters: { page?: number; limit?: number; q?: string; tipo?: TipoEntidad } = {}) {
  return queryOptions({
    queryKey: entidadesKeys.list(filters),
    queryFn: () => entidadesService.list(filters),
    staleTime: 30_000,
  })
}

export function entidadDetailOptions(id: number) {
  return queryOptions({
    queryKey: entidadesKeys.detail(id),
    queryFn: () => entidadesService.getById(id),
    staleTime: 30_000,
    enabled: id > 0,
  })
}

export function paisesOptions() {
  return queryOptions({
    queryKey: entidadesKeys.paises,
    queryFn: () => entidadesService.listPaises(),
    staleTime: 5 * 60_000,
  })
}

export function comunasOptions() {
  return queryOptions({
    queryKey: entidadesKeys.comunas,
    queryFn: () => entidadesService.listComunas(),
    staleTime: 5 * 60_000,
  })
}
