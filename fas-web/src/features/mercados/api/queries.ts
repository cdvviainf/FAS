import { queryOptions } from '@tanstack/react-query';
import { getMercados } from './service';
import type { MercadoFilters } from './types';

export const mercadoKeys = {
  all: ['mercados'] as const,
  list: (filters: MercadoFilters) => [...mercadoKeys.all, 'list', filters] as const
};

export const mercadosQueryOptions = (filters: MercadoFilters) =>
  queryOptions({
    queryKey: mercadoKeys.list(filters),
    queryFn: () => getMercados(filters)
  });
