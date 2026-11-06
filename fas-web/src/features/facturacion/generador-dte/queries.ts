import { queryOptions } from '@tanstack/react-query'
import { generadorDteService } from './service'
import type { DocumentoManualListFilters } from './types'

export const generadorDteKeys = {
  all: ['generador-dte'] as const,
  list: (filters: object) => ['generador-dte', 'list', filters] as const,
  detail: (id: number) => ['generador-dte', 'detail', id] as const,
  receptor: (entidadId: number) => ['generador-dte', 'receptor', entidadId] as const,
}

export function generadorDteListOptions(filters: DocumentoManualListFilters = {}) {
  return queryOptions({
    queryKey: generadorDteKeys.list(filters),
    queryFn: () => generadorDteService.list(filters),
    staleTime: 30_000,
  })
}

export function generadorDteDetailOptions(id: number) {
  return queryOptions({
    queryKey: generadorDteKeys.detail(id),
    queryFn: () => generadorDteService.getById(id),
    staleTime: 30_000,
    enabled: id > 0,
  })
}

export function generadorDteReceptorOptions(entidadId: number) {
  return queryOptions({
    queryKey: generadorDteKeys.receptor(entidadId),
    queryFn: () => generadorDteService.datosReceptor(entidadId),
    staleTime: 30_000,
    enabled: entidadId > 0,
  })
}
