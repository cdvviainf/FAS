'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useQueryStates, parseAsInteger } from 'nuqs'
import { DataTable } from '@/components/ui/table/data-table'
import { DataTableSkeleton } from '@/components/ui/table/data-table-skeleton'
import { useDataTable } from '@/hooks/use-data-table'
import { Button } from '@/components/ui/button'
import { Icons } from '@/components/icons'
import { usePuedeEscribir } from '@/hooks/use-item-acceso'
import { movimientosListOptions } from '../queries'
import { movimientoColumns } from './movimiento-columns'

const ITEM = 'OPER_MATERIALES'

export function MovimientoListingClient() {
  const puedeEscribir = usePuedeEscribir(ITEM)
  const [params] = useQueryStates({
    page: parseAsInteger.withDefault(1),
    perPage: parseAsInteger.withDefault(20),
  })

  const { data, isPending } = useQuery(movimientosListOptions({ page: params.page, limit: params.perPage }))

  const pageCount = data ? Math.ceil(data.meta.total / params.perPage) : 0
  const { table } = useDataTable({
    data: data?.data ?? [],
    columns: movimientoColumns,
    pageCount,
    shallow: true,
  })

  if (isPending) return <DataTableSkeleton columnCount={8} rowCount={8} />

  return (
    <div className='flex flex-1 flex-col space-y-3'>
      {puedeEscribir && (
        <div className='flex justify-end'>
          <Button asChild>
            <Link href='/dashboard/operaciones/movimientos/nuevo'>
              <Icons.add className='mr-2 h-4 w-4' />
              Nuevo Movimiento
            </Link>
          </Button>
        </div>
      )}
      <DataTable table={table} />
    </div>
  )
}
