import { queryOptions } from '@tanstack/react-query';
import { getPaises } from './service';
import type { PaisFilters } from './types';

export const paisKeys = {
  all: ['paises'] as const,
  list: (filters: PaisFilters) => [...paisKeys.all, 'list', filters] as const
};

export const paisesQueryOptions = (filters: PaisFilters = {}) =>
  queryOptions({
    queryKey: paisKeys.list(filters),
    queryFn: () => getPaises(filters),
    staleTime: 0
  });
