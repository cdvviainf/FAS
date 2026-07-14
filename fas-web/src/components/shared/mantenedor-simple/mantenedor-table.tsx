'use client'

import { DataTable } from '@/components/ui/table/data-table'
import { DataTableToolbar } from '@/components/ui/table/data-table-toolbar'
import { DataTableSkeleton } from '@/components/ui/table/data-table-skeleton'
import { useDataTable } from '@/hooks/use-data-table'
import { useQuery } from '@tanstack/react-query'
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs'
import { createMantenedorQueries } from '@/features/mantenedor-simple/queries'
import { createMantenedorColumns } from './mantenedor-columns'
import type { ColumnDef } from '@tanstack/react-table'
import type { MantenedorSimple } from '@/features/mantenedor-simple/types'

interface MantenedorTableProps {
  recurso: string
  titulo: string
  extraColumns?: ColumnDef<MantenedorSimple>[]
  renderEditSheet?: (props: { item: MantenedorSimple; open: boolean; onOpenChange: (v: boolean) => void }) => React.ReactNode
}

export function MantenedorTable({ recurso, titulo, extraColumns, renderEditSheet }: MantenedorTableProps) {
  const { listOptions } = createMantenedorQueries(recurso)

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

  const { data, isPending } = useQuery(listOptions(filters))

  const columns = createMantenedorColumns(recurso, titulo, extraColumns, renderEditSheet)

  const pageCount = data ? Math.ceil(data.meta.total / params.perPage) : 0

  const { table } = useDataTable({
    data: data?.data ?? [],
    columns,
    pageCount,
    shallow: true,
    debounceMs: 500,
    initialState: {
      columnPinning: { right: ['actions'] }
    }
  })

  if (isPending) {
    const colCount = 3 + (extraColumns?.length ?? 0)
    return <DataTableSkeleton columnCount={colCount} rowCount={8} />
  }

  return (
    <DataTable table={table}>
      <DataTableToolbar table={table} />
    </DataTable>
  )
}
