import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client';
import { searchParamsCache } from '@/lib/searchparams';
import { recetasQueryOptions } from '../api/queries';
import { RecetasTable } from './recetas-table';

export default function RecetaListingPage() {
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
  void queryClient.prefetchQuery(recetasQueryOptions(filters));

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <RecetasTable />
    </HydrationBoundary>
  );
}
