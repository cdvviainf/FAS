import { queryOptions } from '@tanstack/react-query'
import { proformasVentaMaterialService } from './service'
import type { ProformaMaterialListFilters } from './types'

export const proformasVentaMaterialKeys = {
  all: ['proformas-venta-material'] as const,
  list: (filters: object) => ['proformas-venta-material', 'list', filters] as const,
  detail: (id: number) => ['proformas-venta-material', 'detail', id] as const,
}

export function proformasVentaMaterialListOptions(filters: ProformaMaterialListFilters = {}) {
  return queryOptions({
    queryKey: proformasVentaMaterialKeys.list(filters),
    queryFn: () => proformasVentaMaterialService.list(filters),
    staleTime: 30_000,
  })
}

export function proformaVentaMaterialDetailOptions(id: number) {
  return queryOptions({
    queryKey: proformasVentaMaterialKeys.detail(id),
    queryFn: () => proformasVentaMaterialService.getById(id),
    staleTime: 30_000,
    enabled: id > 0,
  })
}
