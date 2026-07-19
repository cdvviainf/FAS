import { queryOptions } from '@tanstack/react-query'
import { perfilesService } from './service'

export const perfilesKeys = {
  all: ['perfiles'] as const,
  list: (filters: object) => ['perfiles', 'list', filters] as const,
  detail: (id: number) => ['perfiles', 'detail', id] as const,
  itemsMenu: ['perfiles', 'items-menu'] as const,
}

export function perfilesListOptions(filters: { page?: number; limit?: number; q?: string } = {}) {
  return queryOptions({
    queryKey: perfilesKeys.list(filters),
    queryFn: () => perfilesService.list(filters),
    staleTime: 30_000,
  })
}

export function perfilDetailOptions(id: number) {
  return queryOptions({
    queryKey: perfilesKeys.detail(id),
    queryFn: () => perfilesService.getById(id),
    staleTime: 30_000,
    enabled: id > 0,
  })
}

export function itemsMenuOptions() {
  return queryOptions({
    queryKey: perfilesKeys.itemsMenu,
    queryFn: () => perfilesService.listItemsMenu(),
    staleTime: 5 * 60_000, // 5 minutos — el catálogo cambia poco
  })
}
