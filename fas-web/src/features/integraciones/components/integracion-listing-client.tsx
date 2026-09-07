'use client'

import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { useQuery } from '@tanstack/react-query'
import { useQueryStates, parseAsInteger } from 'nuqs'
import { useRouter } from 'next/navigation'
import { DataTable } from '@/components/ui/table/data-table'
import { DataTableSkeleton } from '@/components/ui/table/data-table-skeleton'
import { useDataTable } from '@/hooks/use-data-table'
import { Button } from '@/components/ui/button'
import { Icons } from '@/components/icons'
import { usePuedeEscribir } from '@/hooks/use-item-acceso'
import { integracionesListOptions } from '../queries'
import { buildIntegracionColumns } from './integracion-columns'
import type { IntegracionListItem } from '../types'
import { IntegracionFormSheet } from './integracion-form-sheet'

const ITEM = 'CONFIG_INTEGRACIONES'

export function IntegracionListingClient() {
  const router = useRouter()
  const puedeEscribir = usePuedeEscribir(ITEM)
  const [params] = useQueryStates({
    page: parseAsInteger.withDefault(1),
    perPage: parseAsInteger.withDefault(20),
  })
  const [formOpen, setFormOpen] = useState(false)

  const { data, isPending } = useQuery(integracionesListOptions({ page: params.page, limit: params.perPage }))

  const columns = useMemo<ColumnDef<IntegracionListItem>[]>(() => [
    ...buildIntegracionColumns(),
    {
      id: 'actions',
      cell: ({ row }) => (
        <Button
          variant='ghost'
          size='icon'
          className='h-8 w-8'
          onClick={() => router.push(`/dashboard/configuracion/integraciones/${row.original.id}`)}
        >
          <Icons.search className='h-4 w-4' />
        </Button>
      ),
    },
  ], [router])

  const pageCount = data ? Math.ceil(data.meta.total / params.perPage) : 0
  const { table } = useDataTable({
    data: data?.data ?? [],
    columns,
    pageCount,
    shallow: true,
    initialState: { columnPinning: { right: ['actions'] } },
  })

  if (isPending) return <DataTableSkeleton columnCount={5} rowCount={5} />

  return (
    <div className='flex flex-1 flex-col space-y-3'>
      {puedeEscribir && (
        <div>
          <Button onClick={() => setFormOpen(true)}>
            <Icons.add className='mr-2 h-4 w-4' /> Nueva Integración
          </Button>
        </div>
      )}
      <DataTable table={table} />
      <IntegracionFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        onCreated={(id) => router.push(`/dashboard/configuracion/integraciones/${id}`)}
      />
    </div>
  )
}
