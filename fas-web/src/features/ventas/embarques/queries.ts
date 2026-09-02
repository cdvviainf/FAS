import { queryOptions } from '@tanstack/react-query'
import { embarquesService } from './service'

export const embarquesKeys = {
  all: ['embarques'] as const,
  list: (filters: object) => ['embarques', 'list', filters] as const,
  detail: (id: number) => ['embarques', 'detail', id] as const,
  palletsDisponibles: (id: number) => ['embarques', 'pallets-disponibles', id] as const,
}

export function embarquesListOptions(filters: { notaVentaId?: number; page?: number; limit?: number } = {}) {
  return queryOptions({
    queryKey: embarquesKeys.list(filters),
    queryFn: () => embarquesService.list(filters),
    staleTime: 30_000,
  })
}

export function embarqueDetailOptions(id: number) {
  return queryOptions({
    queryKey: embarquesKeys.detail(id),
    queryFn: () => embarquesService.getById(id),
    staleTime: 30_000,
    enabled: id > 0,
  })
}

export function embarquePalletsDisponiblesOptions(id: number) {
  return queryOptions({
    queryKey: embarquesKeys.palletsDisponibles(id),
    queryFn: () => embarquesService.listarPalletsDisponibles(id),
    staleTime: 15_000,
    enabled: id > 0,
  })
}
