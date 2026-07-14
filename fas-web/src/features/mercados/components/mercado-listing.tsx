import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client';
import { searchParamsCache } from '@/lib/searchparams';
import { mercadosQueryOptions } from '../api/queries';
import { MercadosTable } from './mercados-table';

export default function MercadoListingPage() {
  const page = searchParamsCache.get('page');
  const q = searchParamsCache.get('q');
  const pageLimit = searchParamsCache.get('perPage');
  const sort = searchParamsCache.get('sort');

  const filters = {
    page,
    limit: pageLimit,
    ...(q && { q }),
    ...(sort && { sort })
  };

  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(mercadosQueryOptions(filters));

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <MercadosTable />
    </HydrationBoundary>
  );
}
