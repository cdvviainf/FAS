import { HydrationBoundary, dehydrate } from '@tanstack/react-query'
import { getQueryClient } from '@/lib/query-client'
import { searchParamsCache } from '@/lib/searchparams'
import { createMantenedorQueries } from '@/features/mantenedor-simple/queries'
import { MantenedorTable } from './mantenedor-table'
import type { ColumnDef } from '@tanstack/react-table'
import type { MantenedorSimple } from '@/features/mantenedor-simple/types'

interface MantenedorListingProps {
  recurso: string
  titulo: string
  extraColumns?: ColumnDef<MantenedorSimple>[]
}

export default function MantenedorListing({
  recurso,
  titulo,
  extraColumns
}: MantenedorListingProps) {
  const page = searchParamsCache.get('page')
  const q = searchParamsCache.get('q')
  const pageLimit = searchParamsCache.get('perPage')

  const filters = {
    page,
    limit: pageLimit,
    ...(q ? { q } : {})
  }

  const { listOptions } = createMantenedorQueries(recurso)
  const queryClient = getQueryClient()
  void queryClient.prefetchQuery(listOptions(filters))

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <MantenedorTable recurso={recurso} titulo={titulo} extraColumns={extraColumns} />
    </HydrationBoundary>
  )
}
