import { queryOptions } from '@tanstack/react-query';
import { getRegiones } from './service';
import type { RegionFilters } from './types';

export const regionKeys = {
  all: ['regiones'] as const,
  list: (filters: RegionFilters) => [...regionKeys.all, 'list', filters] as const
};

export const regionesQueryOptions = (filters: RegionFilters) =>
  queryOptions({
    queryKey: regionKeys.list(filters),
    queryFn: () => getRegiones(filters)
  });
