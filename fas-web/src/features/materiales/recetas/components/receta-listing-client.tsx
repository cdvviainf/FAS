'use client'

import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useQueryStates, parseAsInteger, parseAsString } from 'nuqs'
import { DataTable } from '@/components/ui/table/data-table'
import { DataTableColumnHeader } from '@/components/ui/table/data-table-column-header'
import { DataTableSkeleton } from '@/components/ui/table/data-table-skeleton'
import { useDataTable } from '@/hooks/use-data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Icons } from '@/components/icons'
import { usePuedeEscribir } from '@/hooks/use-item-acceso'
import { recetasListOptions } from '../queries'
import type { Receta } from '../types'
import { RecetaFormSheet } from './receta-form-sheet'
import { RecetaDetalleDialog } from './receta-detalle-dialog'

const ITEM = 'MATERIALES_RECETAS'

export function RecetaListingClient() {
  const puedeEscribir = usePuedeEscribir(ITEM)

  const [params, setParams] = useQueryStates({
    page: parseAsInteger.withDefault(1),
    perPage: parseAsInteger.withDefault(20),
    q: parseAsString,
  })

  const [editItem, setEditItem] = useState<Receta | undefined>()
  const [formOpen, setFormOpen] = useState(false)
  const [verItem, setVerItem] = useState<Receta | undefined>()
  const [verOpen, setVerOpen] = useState(false)

  const filters = {
    page: params.page,
    limit: params.perPage,
    ...(params.q ? { q: params.q } : {}),
  }

  const { data, isPending } = useQuery({ ...recetasListOptions(filters), placeholderData: keepPreviousData })

  const columns = useMemo<ColumnDef<Receta>[]>(() => [
    {
      accessorKey: 'codigo',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Código' />,
      enableSorting: false,
      cell: ({ row }) => <span className='font-medium'>{row.original.codigo}</span>,
    },
    {
      id: 'embalaje',
      header: () => 'Embalaje',
      enableSorting: false,
      cell: ({ row }) => `${row.original.embalaje.codigo} — ${row.original.embalaje.descripcion}`,
    },
    {
      accessorKey: 'descripcion',
      header: () => 'Descripción',
      enableSorting: false,
    },
    {
      id: 'cantidadAProducir',
      header: () => 'Cant. a producir',
      enableSorting: false,
      cell: ({ row }) => row.original.cantidadAProducir,
    },
    {
      id: 'componentes',
      header: () => 'Componentes',
      enableSorting: false,
      cell: ({ row }) => <Badge variant='outline'>{row.original.detalle.length}</Badge>,
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <div className='flex items-center gap-1'>
          <Button variant='ghost' size='icon' className='h-8 w-8' title='Ver detalle' onClick={() => { setVerItem(row.original); setVerOpen(true) }}>
            <Icons.search className='h-4 w-4' />
          </Button>
          {puedeEscribir && (
            <Button variant='ghost' size='icon' className='h-8 w-8' title='Editar' onClick={() => { setEditItem(row.original); setFormOpen(true) }}>
              <Icons.edit className='h-4 w-4' />
            </Button>
          )}
        </div>
      ),
    },
  ], [puedeEscribir])

  const pageCount = data ? Math.ceil(data.meta.total / params.perPage) : 0
  const { table } = useDataTable({
    data: data?.data ?? [],
    columns,
    pageCount,
    shallow: true,
    debounceMs: 500,
    // pageSize alineado con el `perPage` que se envía a la API y con el que se
    // calcula pageCount (REC-LIST-003): evita que la tabla muestre 10 mientras
    // el servidor devuelve 20.
    initialState: { pagination: { pageIndex: params.page - 1, pageSize: params.perPage }, columnPinning: { right: ['actions'] } },
  })

  if (isPending) return <DataTableSkeleton columnCount={6} rowCount={10} />

  return (
    <div className='flex flex-1 flex-col space-y-3'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <Input
          placeholder='Buscar código, descripción o embalaje...'
          value={params.q ?? ''}
          onChange={(e) => setParams({ q: e.target.value || null, page: 1 })}
          className='h-9 w-[320px]'
        />
        {puedeEscribir && (
          <Button onClick={() => { setEditItem(undefined); setFormOpen(true) }}>
            <Icons.add className='mr-2 h-4 w-4' /> Nueva Receta
          </Button>
        )}
      </div>

      <DataTable table={table} />

      <RecetaFormSheet
        item={editItem}
        open={formOpen}
        onOpenChange={(v) => { setFormOpen(v); if (!v) setEditItem(undefined) }}
      />

      <RecetaDetalleDialog
        receta={verItem}
        open={verOpen}
        onOpenChange={(v) => { setVerOpen(v); if (!v) setVerItem(undefined) }}
      />
    </div>
  )
}
