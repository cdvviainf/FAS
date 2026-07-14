import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client';
import { searchParamsCache } from '@/lib/searchparams';
import { articulosQueryOptions } from '../api/queries';
import { ArticulosTable } from './articulos-table';

export default function ArticuloListingPage() {
  const page = searchParamsCache.get('page');
  const q = searchParamsCache.get('q');
  const pageLimit = searchParamsCache.get('perPage');
  const tipo = searchParamsCache.get('tipo');
  const sort = searchParamsCache.get('sort');

  const filters = {
    page,
    limit: pageLimit,
    ...(q && { q }),
    ...(tipo && { tipo }),
    ...(sort && { sort })
  };

  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(articulosQueryOptions(filters));

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ArticulosTable />
    </HydrationBoundary>
  );
}
