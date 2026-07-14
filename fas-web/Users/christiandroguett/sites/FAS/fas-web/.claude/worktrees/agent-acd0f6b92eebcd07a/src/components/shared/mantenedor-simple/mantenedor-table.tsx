'use client'

import { DataTable } from '@/components/ui/table/data-table'
import { DataTableToolbar } from '@/components/ui/table/data-table-toolbar'
import { useDataTable } from '@/hooks/use-data-table'
import { useSuspenseQuery } from '@tanstack/react-query'
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs'
import { createMantenedorQueries } from '@/features/mantenedor-simple/queries'
import { createMantenedorColumns } from './mantenedor-columns'
import type { ColumnDef } from '@tanstack/react-table'
import type { MantenedorSimple } from '@/features/mantenedor-simple/types'

interface MantenedorTableProps {
  recurso: string
  titulo: string
  extraColumns?: ColumnDef<MantenedorSimple>[]
}

export function MantenedorTable({ recurso, titulo, extraColumns }: MantenedorTableProps) {
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

  const { data } = useSuspenseQuery(listOptions(filters))

  const pageCount = Math.ceil(data.meta.total / params.perPage)

  const columns = createMantenedorColumns(recurso, titulo, extraColumns)

  const { table } = useDataTable({
    data: data.data,
    columns,
    pageCount,
    shallow: true,
    debounceMs: 500,
    initialState: {
      columnPinning: { right: ['actions'] }
    }
  })

  return (
    <DataTable table={table}>
      <DataTableToolbar table={table} />
    </DataTable>
  )
}
