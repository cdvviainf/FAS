import { queryOptions } from '@tanstack/react-query'
import { empresasService } from './service'

export const empresasKeys = {
  all: ['empresas'] as const,
  list: (filters: object) => ['empresas', 'list', filters] as const,
  detail: (id: number) => ['empresas', 'detail', id] as const,
  paises: ['empresas-paises'] as const,
  comunas: ['empresas-comunas'] as const,
}

export function empresasListOptions(filters: { page?: number; limit?: number; q?: string; activo?: boolean } = {}) {
  return queryOptions({
    queryKey: empresasKeys.list(filters),
    queryFn: () => empresasService.list(filters),
    staleTime: 30_000,
  })
}

export function empresaDetailOptions(id: number) {
  return queryOptions({
    queryKey: empresasKeys.detail(id),
    queryFn: () => empresasService.getById(id),
    staleTime: 30_000,
    enabled: id > 0,
  })
}

export function empresasPaisesOptions() {
  return queryOptions({
    queryKey: empresasKeys.paises,
    queryFn: () => empresasService.listPaises(),
    staleTime: 5 * 60_000,
  })
}

export function empresasComunasOptions() {
  return queryOptions({
    queryKey: empresasKeys.comunas,
    queryFn: () => empresasService.listComunas(),
    staleTime: 5 * 60_000,
  })
}
