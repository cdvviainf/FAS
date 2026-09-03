import { queryOptions } from '@tanstack/react-query'
import { ordenesCompraMaterialService } from './service'
import type { EstadoOrdenCompraMaterial } from './types'

export const ordenesCompraMaterialKeys = {
  all: ['ordenes-compra-material'] as const,
  list: (filters: object) => ['ordenes-compra-material', 'list', filters] as const,
  detail: (id: number) => ['ordenes-compra-material', 'detail', id] as const,
}

export function ordenesCompraMaterialListOptions(filters: { page?: number; limit?: number; entidadProveedorId?: number; estado?: EstadoOrdenCompraMaterial } = {}) {
  return queryOptions({
    queryKey: ordenesCompraMaterialKeys.list(filters),
    queryFn: () => ordenesCompraMaterialService.list(filters),
    staleTime: 30_000,
  })
}

export function ordenCompraMaterialDetailOptions(id: number) {
  return queryOptions({
    queryKey: ordenesCompraMaterialKeys.detail(id),
    queryFn: () => ordenesCompraMaterialService.getById(id),
    staleTime: 30_000,
    enabled: id > 0,
  })
}
