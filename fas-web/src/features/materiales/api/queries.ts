import { queryOptions } from '@tanstack/react-query';
import { getArticulos } from './service';
import type { ArticuloFilters } from './types';

export const articuloKeys = {
  all: ['articulos'] as const,
  list: (filters: ArticuloFilters) => [...articuloKeys.all, 'list', filters] as const
};

export const articulosQueryOptions = (filters: ArticuloFilters) =>
  queryOptions({
    queryKey: articuloKeys.list(filters),
    queryFn: () => getArticulos(filters)
  });
