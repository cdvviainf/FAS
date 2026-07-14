import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client';
import { searchParamsCache } from '@/lib/searchparams';
import { regionesQueryOptions } from '../api/queries';
import { RegionesTable } from './regiones-table';

export default function RegionListingPage() {
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
  void queryClient.prefetchQuery(regionesQueryOptions(filters));

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <RegionesTable />
    </HydrationBoundary>
  );
}
