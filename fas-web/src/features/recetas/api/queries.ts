import { queryOptions } from '@tanstack/react-query';
import { fetchRecetas } from './service';
import type { RecetaFilters } from './types';

export const recetaKeys = {
  all: ['recetas'] as const,
  lists: () => [...recetaKeys.all, 'list'] as const,
  list: (filters: RecetaFilters) => [...recetaKeys.lists(), filters] as const
};

export function recetasQueryOptions(filters: RecetaFilters) {
  return queryOptions({
    queryKey: recetaKeys.list(filters),
    queryFn: () => fetchRecetas(filters)
  });
}
