'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useQueryStates, parseAsInteger } from 'nuqs'
import { DataTable } from '@/components/ui/table/data-table'
import { DataTableToolbar } from '@/components/ui/table/data-table-toolbar'
import { DataTableSkeleton } from '@/components/ui/table/data-table-skeleton'
import { useDataTable } from '@/hooks/use-data-table'
import { Button } from '@/components/ui/button'
import { Icons } from '@/components/icons'
import { usePuedeEscribir } from '@/hooks/use-item-acceso'
import { notasVentaListOptions } from '../queries'
import { notaVentaColumns } from './nota-venta-columns'

const ITEM = 'ventas.notas'

export function NotaVentaListingClient() {
  const puedeEscribir = usePuedeEscribir(ITEM)
  const [params] = useQueryStates({
    page: parseAsInteger.withDefault(1),
    perPage: parseAsInteger.withDefault(20),
  })

  const filters = { page: params.page, limit: params.perPage }
  const { data, isPending } = useQuery(notasVentaListOptions(filters))

  const pageCount = data ? Math.ceil(data.meta.total / params.perPage) : 0

  const { table } = useDataTable({
    data: data?.data ?? [],
    columns: notaVentaColumns,
    pageCount,
    shallow: true,
    debounceMs: 500,
    initialState: {
      columnPinning: { right: ['actions'] },
    },
  })

  if (isPending) {
    return <DataTableSkeleton columnCount={6} rowCount={10} />
  }

  return (
    <div className='space-y-3'>
      {puedeEscribir && (
        <div className='flex justify-end'>
          <Button asChild>
            <Link href='/dashboard/ventas/notas/nueva'>
              <Icons.add className='mr-2 h-4 w-4' />
              Nueva Nota de Venta
            </Link>
          </Button>
        </div>
      )}
      <DataTable table={table}>
        <DataTableToolbar table={table} />
      </DataTable>
    </div>
  )
}
