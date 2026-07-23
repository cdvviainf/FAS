'use client'

import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { useQuery } from '@tanstack/react-query'
import { useQueryStates, parseAsInteger } from 'nuqs'
import { DataTable } from '@/components/ui/table/data-table'
import { DataTableSkeleton } from '@/components/ui/table/data-table-skeleton'
import { useDataTable } from '@/hooks/use-data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Icons } from '@/components/icons'
import { usePuedeEscribir } from '@/hooks/use-item-acceso'
import { tiposMovimientoListOptions } from '../queries'
import { CLASE_MOVIMIENTO_LABELS } from '../types'
import type { TipoMovimiento } from '../types'
import { TipoMovimientoFormSheet } from './tipo-movimiento-form-sheet'

const ITEM = 'operaciones.materiales'

export function TipoMovimientoListingClient() {
  const puedeEscribir = usePuedeEscribir(ITEM)
  const [params] = useQueryStates({
    page: parseAsInteger.withDefault(1),
    perPage: parseAsInteger.withDefault(20),
  })
  const [editItem, setEditItem] = useState<TipoMovimiento | undefined>()
  const [formOpen, setFormOpen] = useState(false)

  const { data, isPending } = useQuery(tiposMovimientoListOptions({ page: params.page, limit: params.perPage }))

  const columns = useMemo<ColumnDef<TipoMovimiento>[]>(() => [
    { accessorKey: 'codigo', header: 'Código', cell: ({ row }) => <span className='font-medium'>{row.original.codigo}</span> },
    { accessorKey: 'descripcion', header: 'Descripción' },
    { id: 'clase', header: 'Clase', cell: ({ row }) => <Badge variant='outline'>{CLASE_MOVIMIENTO_LABELS[row.original.clase]}</Badge> },
    { id: 'modulos', header: 'Módulos', cell: ({ row }) => row.original.modulos.join(', ') },
    { id: 'requierePrecio', header: 'Precio', cell: ({ row }) => row.original.requierePrecio ? 'Sí' : 'No' },
    { id: 'emiteDTE', header: 'DTE', cell: ({ row }) => row.original.emiteDTE ? 'Sí' : 'No' },
    {
      id: 'activo',
      header: 'Estado',
      cell: ({ row }) => <Badge variant={row.original.activo ? 'default' : 'secondary'}>{row.original.activo ? 'Activo' : 'Inactivo'}</Badge>,
    },
    {
      id: 'actions',
      cell: ({ row }) => puedeEscribir ? (
        <Button variant='ghost' size='icon' className='h-8 w-8' onClick={() => { setEditItem(row.original); setFormOpen(true) }}>
          <Icons.edit className='h-4 w-4' />
        </Button>
      ) : null,
    },
  ], [puedeEscribir])

  const pageCount = data ? Math.ceil(data.meta.total / params.perPage) : 0
  const { table } = useDataTable({
    data: data?.data ?? [],
    columns,
    pageCount,
    shallow: true,
    initialState: { columnPinning: { right: ['actions'] } },
  })

  if (isPending) return <DataTableSkeleton columnCount={7} rowCount={8} />

  return (
    <div className='space-y-3'>
      <DataTable table={table} />
      <TipoMovimientoFormSheet
        item={editItem}
        open={formOpen}
        onOpenChange={(v) => { setFormOpen(v); if (!v) setEditItem(undefined) }}
      />
    </div>
  )
}
