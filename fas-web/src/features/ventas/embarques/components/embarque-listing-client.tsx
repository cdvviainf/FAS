'use client'

import { useQuery } from '@tanstack/react-query'
import { useQueryStates, parseAsInteger } from 'nuqs'
import { DataTable } from '@/components/ui/table/data-table'
import { DataTableToolbar } from '@/components/ui/table/data-table-toolbar'
import { DataTableSkeleton } from '@/components/ui/table/data-table-skeleton'
import { useDataTable } from '@/hooks/use-data-table'
import { embarquesListOptions } from '../queries'
import { embarqueColumns } from './embarque-columns'

export function EmbarqueListingClient() {
  const [params] = useQueryStates({
    page: parseAsInteger.withDefault(1),
    perPage: parseAsInteger.withDefault(20),
  })

  const filters = { page: params.page, limit: params.perPage }
  const { data, isPending } = useQuery(embarquesListOptions(filters))

  const pageCount = data ? Math.ceil(data.meta.total / params.perPage) : 0

  const { table } = useDataTable({
    data: data?.data ?? [],
    columns: embarqueColumns,
    pageCount,
    shallow: true,
    debounceMs: 500,
    initialState: {
      columnPinning: { right: ['actions'] },
    },
  })

  if (isPending) {
    return <DataTableSkeleton columnCount={4} rowCount={10} />
  }

  return (
    <div className='flex flex-1 flex-col space-y-3'>
      <p className='text-sm text-muted-foreground'>
        Los Embarques se generan desde el menú de acciones de un Cierre Comercial (&quot;Generar Embarque&quot;).
      </p>
      <DataTable table={table}>
        <DataTableToolbar table={table} />
      </DataTable>
    </div>
  )
}
