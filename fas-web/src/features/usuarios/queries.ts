import { queryOptions } from '@tanstack/react-query'
import { usuariosService } from './service'

export const usuariosKeys = {
  all: ['usuarios'] as const,
  list: (filters: object) => ['usuarios', 'list', filters] as const,
  detail: (id: string) => ['usuarios', 'detail', id] as const,
}

export function usuariosListOptions(filters: { page?: number; limit?: number; q?: string; perfilId?: number } = {}) {
  return queryOptions({
    queryKey: usuariosKeys.list(filters),
    queryFn: () => usuariosService.list(filters),
    staleTime: 30_000,
  })
}

export function usuarioDetailOptions(id: string) {
  return queryOptions({
    queryKey: usuariosKeys.detail(id),
    queryFn: () => usuariosService.getById(id),
    staleTime: 30_000,
    enabled: !!id,
  })
}
