'use client'

import { useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { useQuery } from '@tanstack/react-query'
import { useQueryStates, parseAsInteger, parseAsString } from 'nuqs'
import { useRouter } from 'next/navigation'
import { DataTable } from '@/components/ui/table/data-table'
import { DataTableColumnHeader } from '@/components/ui/table/data-table-column-header'
import { DataTableSkeleton } from '@/components/ui/table/data-table-skeleton'
import { useDataTable } from '@/hooks/use-data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Icons } from '@/components/icons'
import { productoresListOptions } from '../queries'
import type { ProductorListItem } from '../types'

export function ProductorListingClient() {
  const router = useRouter()
  const [params, setParams] = useQueryStates({
    page: parseAsInteger.withDefault(1),
    perPage: parseAsInteger.withDefault(20),
    q: parseAsString,
  })

  const { data, isPending } = useQuery(productoresListOptions({ page: params.page, limit: params.perPage, q: params.q ?? undefined }))

  const columns = useMemo<ColumnDef<ProductorListItem>[]>(() => [
    {
      accessorKey: 'codigo',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Código' />,
      cell: ({ row }) => <span className='font-medium'>{row.original.codigo}</span>,
    },
    { accessorKey: 'descripcion', header: 'Nombre' },
    { accessorKey: 'razonSocial', header: 'Razón Social' },
    {
      id: 'activo',
      header: 'Estado',
      cell: ({ row }) => (
        <Badge variant={row.original.activo ? 'default' : 'secondary'}>
          {row.original.activo ? 'Activo' : 'Inactivo'}
        </Badge>
      ),
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <Button variant='ghost' size='icon' className='h-8 w-8' onClick={() => router.push(`/dashboard/configuracion/productores/${row.original.id}`)}>
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
    debounceMs: 500,
    initialState: { columnPinning: { right: ['actions'] } },
  })

  if (isPending) return <DataTableSkeleton columnCount={5} rowCount={10} />

  return (
    <div className='space-y-3'>
      <Input
        placeholder='Buscar productor...'
        value={params.q ?? ''}
        onChange={(e) => setParams({ q: e.target.value || null, page: 1 })}
        className='h-9 w-[280px]'
      />
      <DataTable table={table} />
    </div>
  )
}
