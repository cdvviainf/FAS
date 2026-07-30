'use client'

import Link from 'next/link'
import type { ColumnDef } from '@tanstack/react-table'
import { Button } from '@/components/ui/button'
import { Icons } from '@/components/icons'
import type { Embarque } from '../types'

export const embarqueColumns: ColumnDef<Embarque>[] = [
  {
    id: 'numeroInstructivo',
    accessorKey: 'numeroInstructivo',
    header: 'Folio',
    enableSorting: false,
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
    id: 'creadoEn',
    accessorKey: 'creadoEn',
    header: 'Creado',
    enableSorting: false,
    cell: ({ cell }) => <span className='text-sm'>{new Date(cell.getValue<string>()).toLocaleDateString('es-CL')}</span>,
    size: 110,
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
