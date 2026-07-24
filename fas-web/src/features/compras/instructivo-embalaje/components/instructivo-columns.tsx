'use client'

import type { ColumnDef } from '@tanstack/react-table'
import { DataTableColumnHeader } from '@/components/ui/table/data-table-column-header'
import { Button } from '@/components/ui/button'
import { Icons } from '@/components/icons'
import { useRouter } from 'next/navigation'
import type { InstructivoEmbalajeListItem } from '../types'

function InstructivoCellAction({ instructivo }: { instructivo: InstructivoEmbalajeListItem }) {
  const router = useRouter()
  return (
    <Button
      variant='ghost'
      size='sm'
      onClick={() => router.push(`/dashboard/compras/instructivo-embalaje/${instructivo.id}`)}
    >
      <Icons.page className='mr-1 h-4 w-4' /> Ver
    </Button>
  )
}

export const instructivoColumns: ColumnDef<InstructivoEmbalajeListItem>[] = [
  {
    id: 'numero',
    accessorKey: 'numero',
    header: ({ column }) => <DataTableColumnHeader column={column} title='N°' />,
    cell: ({ cell }) => <span className='font-mono text-sm'>{cell.getValue<number>()}</span>,
    size: 90,
  },
  {
    id: 'notaVenta',
    header: 'Nota de Venta',
    cell: ({ row }) => <span className='font-mono text-sm'>Folio {row.original.notaVenta.folio}</span>,
    size: 140,
  },
  {
    id: 'creadoEn',
    accessorKey: 'creadoEn',
    header: ({ column }) => <DataTableColumnHeader column={column} title='Emitido' />,
    cell: ({ cell }) => <span className='text-sm'>{new Date(cell.getValue<string>()).toLocaleString('es-CL')}</span>,
  },
  {
    id: 'actions',
    size: 90,
    cell: ({ row }) => <InstructivoCellAction instructivo={row.original} />,
  },
]
