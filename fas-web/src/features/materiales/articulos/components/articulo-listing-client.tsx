'use client'

import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { useQuery } from '@tanstack/react-query'
import { useQueryStates, parseAsInteger, parseAsString, parseAsStringEnum } from 'nuqs'
import { useRouter } from 'next/navigation'
import { DataTable } from '@/components/ui/table/data-table'
import { DataTableColumnHeader } from '@/components/ui/table/data-table-column-header'
import { DataTableSkeleton } from '@/components/ui/table/data-table-skeleton'
import { useDataTable } from '@/hooks/use-data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Icons } from '@/components/icons'
import { usePuedeEscribir } from '@/hooks/use-item-acceso'
import { articulosListOptions } from '../queries'
import { TIPO_ARTICULO_LABELS } from '../types'
import type { Articulo, TipoArticulo } from '../types'
import { ArticuloFormSheet } from './articulo-form-sheet'

const ITEM = 'operaciones.materiales'

export function ArticuloListingClient() {
  const router = useRouter()
  const puedeEscribir = usePuedeEscribir(ITEM)

  const [params, setParams] = useQueryStates({
    page: parseAsInteger.withDefault(1),
    perPage: parseAsInteger.withDefault(20),
    q: parseAsString,
    tipo: parseAsStringEnum<TipoArticulo>(['EMBALAJE', 'ENVASE', 'MATERIAL_EMBALAJE', 'SERVICIO']),
    estado: parseAsStringEnum<'activo' | 'inactivo'>(['activo', 'inactivo']),
  })

  const [editItem, setEditItem] = useState<Articulo | undefined>()
  const [formOpen, setFormOpen] = useState(false)

  const filters = {
    page: params.page,
    limit: params.perPage,
    ...(params.q ? { q: params.q } : {}),
    ...(params.tipo ? { tipo: params.tipo } : {}),
    ...(params.estado ? { activo: params.estado === 'activo' } : {}),
  }

  const { data, isPending } = useQuery(articulosListOptions(filters))

  const columns = useMemo<ColumnDef<Articulo>[]>(() => [
    {
      accessorKey: 'codigo',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Código' />,
      cell: ({ row }) => <span className='font-medium'>{row.original.codigo}</span>,
    },
    {
      accessorKey: 'descripcion',
      header: 'Descripción',
    },
    {
      id: 'tipo',
      header: 'Tipo',
      cell: ({ row }) => <Badge variant='outline'>{TIPO_ARTICULO_LABELS[row.original.tipo]}</Badge>,
    },
    {
      id: 'unidad',
      header: 'Unidad',
      cell: ({ row }) => row.original.unidad.descripcion,
    },
    {
      id: 'costeo',
      header: 'Costeo',
      cell: ({ row }) => row.original.tipoCosteo === 'ESTANDAR' ? `Estándar (${row.original.valorEstandar})` : 'Promedio Ponderado',
    },
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
        <div className='flex items-center gap-1'>
          <Button variant='ghost' size='icon' className='h-8 w-8' onClick={() => router.push(`/dashboard/configuracion/articulos/${row.original.id}`)}>
            <Icons.search className='h-4 w-4' />
          </Button>
          {puedeEscribir && (
            <Button variant='ghost' size='icon' className='h-8 w-8' onClick={() => { setEditItem(row.original); setFormOpen(true) }}>
              <Icons.edit className='h-4 w-4' />
            </Button>
          )}
        </div>
      ),
    },
  ], [puedeEscribir, router])

  const pageCount = data ? Math.ceil(data.meta.total / params.perPage) : 0
  const { table } = useDataTable({
    data: data?.data ?? [],
    columns,
    pageCount,
    shallow: true,
    debounceMs: 500,
    initialState: { columnPinning: { right: ['actions'] } },
  })

  if (isPending) return <DataTableSkeleton columnCount={6} rowCount={10} />

  return (
    <div className='space-y-3'>
      <div className='flex flex-wrap items-center gap-2'>
        <Input
          placeholder='Buscar código o descripción...'
          value={params.q ?? ''}
          onChange={(e) => setParams({ q: e.target.value || null, page: 1 })}
          className='h-9 w-[260px]'
        />
        <Select
          value={params.tipo ?? 'all'}
          onValueChange={(v) => setParams({ tipo: v === 'all' ? null : (v as TipoArticulo), page: 1 })}
        >
          <SelectTrigger className='h-9 w-[200px]'><SelectValue placeholder='Todos los tipos' /></SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>Todos los tipos</SelectItem>
            {(Object.keys(TIPO_ARTICULO_LABELS) as TipoArticulo[]).map((t) => (
              <SelectItem key={t} value={t}>{TIPO_ARTICULO_LABELS[t]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={params.estado ?? 'all'}
          onValueChange={(v) => setParams({ estado: v === 'all' ? null : (v as 'activo' | 'inactivo'), page: 1 })}
        >
          <SelectTrigger className='h-9 w-[160px]'><SelectValue placeholder='Todos los estados' /></SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>Todos los estados</SelectItem>
            <SelectItem value='activo'>Activo</SelectItem>
            <SelectItem value='inactivo'>Inactivo</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable table={table} />

      <ArticuloFormSheet
        item={editItem}
        open={formOpen}
        onOpenChange={(v) => { setFormOpen(v); if (!v) setEditItem(undefined) }}
      />
    </div>
  )
}
