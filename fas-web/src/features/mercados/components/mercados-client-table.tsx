'use client'

import { DataTable } from '@/components/ui/table/data-table'
import { DataTableToolbar } from '@/components/ui/table/data-table-toolbar'
import { DataTableSkeleton } from '@/components/ui/table/data-table-skeleton'
import { useDataTable } from '@/hooks/use-data-table'
import { useQuery } from '@tanstack/react-query'
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs'
import { mercadosQueryOptions } from '../api/queries'
import { columns } from './mercados-table/columns'

export function MercadosClientTable() {
  const [params] = useQueryStates({
    page: parseAsInteger.withDefault(1),
    perPage: parseAsInteger.withDefault(10),
    q: parseAsString
  })

  const filters = {
    page: params.page,
    limit: params.perPage,
    ...(params.q ? { q: params.q } : {})
  }

  const { data, isPending } = useQuery(mercadosQueryOptions(filters))

  const pageCount = data ? Math.ceil(data.total / params.perPage) : 0

  const { table } = useDataTable({
    data: data?.mercados ?? [],
    columns,
    pageCount,
    shallow: true,
    debounceMs: 500,
    initialState: {
      columnPinning: { right: ['actions'] }
    }
  })

  if (isPending) {
    return <DataTableSkeleton columnCount={5} rowCount={8} />
  }

  return (
    <DataTable table={table}>
      <DataTableToolbar table={table} />
    </DataTable>
  )
}
