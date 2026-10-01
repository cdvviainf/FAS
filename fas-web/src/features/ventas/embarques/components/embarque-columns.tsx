'use client'

import Link from 'next/link'
import type { ColumnDef } from '@tanstack/react-table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Icons } from '@/components/icons'
import { DataTableColumnHeader } from '@/components/ui/table/data-table-column-header'
import { formatFechaCorta, semanaISO } from '@/lib/format'
import { ESTADO_EMBARQUE_LISTADO_LABELS } from '../types'
import type { Embarque, EstadoEmbarqueListado } from '../types'

const ESTADO_BADGE_VARIANT: Record<EstadoEmbarqueListado, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  PENDIENTE: 'outline',
  SOLICITADA: 'secondary',
  CONFIRMADA: 'default',
  DESPACHADO: 'default',
  DESPACHO_ANULADO: 'destructive',
}

export const embarqueColumns: ColumnDef<Embarque>[] = [
  {
    id: 'numeroInstructivo',
    accessorKey: 'numeroInstructivo',
    header: ({ column }) => <DataTableColumnHeader column={column} title='Instructivo' />,
    cell: ({ cell }) => <span className='font-mono text-sm'>{cell.getValue<string>()}</span>,
  },
  {
    id: 'notaVenta',
    header: 'Cierre Comercial',
    enableSorting: false,
    cell: ({ row }) => (
      <Link href={`/dashboard/ventas/cierre/${row.original.notaVentaId}`} className='text-sm text-primary hover:underline'>
        Folio {row.original.notaVenta.folio}
      </Link>
    ),
  },
  {
    id: 'cliente',
    header: ({ column }) => <DataTableColumnHeader column={column} title='Cliente' />,
    cell: ({ row }) => <span className='text-sm'>{row.original.notaVenta.cliente?.descripcion ?? '—'}</span>,
  },
  {
    id: 'mercado',
    header: ({ column }) => <DataTableColumnHeader column={column} title='Mercado' />,
    cell: ({ row }) => <span className='text-sm'>{row.original.notaVenta.mercado?.descripcion ?? '—'}</span>,
    size: 140,
  },
  {
    id: 'puertoDestino',
    header: ({ column }) => <DataTableColumnHeader column={column} title='Puerto destino' />,
    cell: ({ row }) => <span className='text-sm'>{row.original.notaVenta.puertoDestino?.descripcion ?? '—'}</span>,
    size: 150,
  },
  {
    id: 'creadoEn',
    accessorKey: 'creadoEn',
    header: ({ column }) => <DataTableColumnHeader column={column} title='Creado' />,
    cell: ({ cell }) => <span className='text-sm'>{formatFechaCorta(cell.getValue<string>())}</span>,
    size: 110,
  },
  {
    id: 'semana',
    header: 'Semana',
    enableSorting: false,
    cell: ({ row }) => {
      const semana = semanaISO(row.original.creadoEn)
      return <span className='text-sm tabular-nums'>{semana ?? '—'}</span>
    },
    size: 80,
  },
  {
    id: 'estado',
    header: 'Estado',
    enableSorting: false,
    cell: ({ row }) => {
      const estado = row.original.estadoListado
      if (!estado) return <span className='text-muted-foreground text-xs'>—</span>
      return <Badge variant={ESTADO_BADGE_VARIANT[estado]}>{ESTADO_EMBARQUE_LISTADO_LABELS[estado]}</Badge>
    },
    size: 130,
  },
  {
    id: 'reclamo',
    header: 'Reclamo',
    enableSorting: false,
    cell: ({ row }) => {
      const tieneReclamo = (row.original._count?.reclamos ?? 0) > 0
      return tieneReclamo ? <Badge variant='destructive'>Sí</Badge> : <span className='text-muted-foreground text-sm'>No</span>
    },
    size: 90,
  },
  {
    id: 'actions',
    size: 50,
    cell: ({ row }) => (
      <Button variant='ghost' size='icon' className='h-8 w-8' asChild>
        <Link href={`/dashboard/ventas/embarques/${row.original.id}`}>
          <Icons.edit className='h-4 w-4' />
        </Link>
      </Button>
    ),
  },
]
