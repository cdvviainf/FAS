'use client'

import { useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { useQuery } from '@tanstack/react-query'
import { useQueryStates, parseAsInteger } from 'nuqs'
import { DataTable } from '@/components/ui/table/data-table'
import { DataTableSkeleton } from '@/components/ui/table/data-table-skeleton'
import { useDataTable } from '@/hooks/use-data-table'
import { Badge } from '@/components/ui/badge'
import { movimientosListOptions } from '../queries'
import type { Movimiento } from '../types'

const fmt = new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium', timeZone: 'America/Santiago' })

export function MovimientoListingClient() {
  const [params] = useQueryStates({
    page: parseAsInteger.withDefault(1),
    perPage: parseAsInteger.withDefault(20),
  })

  const { data, isPending } = useQuery(movimientosListOptions({ page: params.page, limit: params.perPage }))

  const columns = useMemo<ColumnDef<Movimiento>[]>(() => [
    { id: 'fecha', header: 'Fecha', cell: ({ row }) => fmt.format(new Date(row.original.fechaMovimiento)) },
    { id: 'tipo', header: 'Tipo', cell: ({ row }) => <Badge variant='outline'>{row.original.tipoMovimiento.descripcion}</Badge> },
    { id: 'clase', header: 'Clase', cell: ({ row }) => row.original.tipoMovimiento.clase },
    {
      id: 'bodegas',
      header: 'Bodegas',
      cell: ({ row }) => {
        const o = row.original.bodegaOrigen?.descripcion
        const d = row.original.bodegaDestino?.descripcion
        if (o && d) return `${o} → ${d}`
        return o ?? d ?? '—'
      },
    },
    { id: 'entidad', header: 'Entidad', cell: ({ row }) => row.original.entidad?.descripcion ?? '—' },
    { id: 'lineas', header: 'Líneas', cell: ({ row }) => row.original.detalle.length },
    { id: 'guia', header: 'Guía', cell: ({ row }) => row.original.guiaReferencia ?? '—' },
  ], [])

  const pageCount = data ? Math.ceil(data.meta.total / params.perPage) : 0
  const { table } = useDataTable({
    data: data?.data ?? [],
    columns,
    pageCount,
    shallow: true,
  })

  if (isPending) return <DataTableSkeleton columnCount={7} rowCount={8} />

  return <DataTable table={table} />
}
