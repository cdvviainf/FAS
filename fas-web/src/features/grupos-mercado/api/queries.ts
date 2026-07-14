import { queryOptions } from '@tanstack/react-query';
import { getGruposMercado } from './service';
import type { GrupoMercadoFilters } from './types';

export const grupoMercadoKeys = {
  all: ['grupos-mercado'] as const,
  list: (filters: GrupoMercadoFilters) => [...grupoMercadoKeys.all, 'list', filters] as const
};

export const gruposMercadoQueryOptions = (filters: GrupoMercadoFilters = {}) =>
  queryOptions({
    queryKey: grupoMercadoKeys.list(filters),
    queryFn: () => getGruposMercado(filters),
    staleTime: 0
  });
