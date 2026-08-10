'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTableColumnHeader } from '@/components/ui/table/data-table-column-header'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { AlertModal } from '@/components/modal/alert-modal'
import { Icons } from '@/components/icons'
import { usePuedeEscribir } from '@/hooks/use-item-acceso'
import { instructivoEmbalajeService } from '../service'
import { instructivosEmbalajeKeys } from '../queries'
import type { InstructivoEmbalajeListItem } from '../types'

const ITEM = 'COMPRAS_INSTRUCTIVO'

function InstructivoCellAction({ instructivo }: { instructivo: InstructivoEmbalajeListItem }) {
  const [deleteOpen, setDeleteOpen] = useState(false)
  const queryClient = useQueryClient()
  const router = useRouter()
  const puedeEscribir = usePuedeEscribir(ITEM)

  const deleteMutation = useMutation({
    mutationFn: () => instructivoEmbalajeService.remove(instructivo.id),
    onSuccess: () => {
      toast.success('Instructivo de Embalaje eliminado')
      setDeleteOpen(false)
      queryClient.invalidateQueries({ queryKey: instructivosEmbalajeKeys.all })
    },
    onError: (e: Error) => toast.error(e.message || 'Error al eliminar el Instructivo de Embalaje'),
  })

  return (
    <>
      <AlertModal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => deleteMutation.mutate()}
        loading={deleteMutation.isPending}
      />
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant='ghost' className='h-8 w-8 p-0'>
            <span className='sr-only'>Abrir menú</span>
            <Icons.ellipsis className='h-4 w-4' />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end'>
          <DropdownMenuLabel>Acciones</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => router.push(`/dashboard/compras/instructivo-embalaje/${instructivo.id}`)}>
            <Icons.edit className='mr-2 h-4 w-4' />
            {puedeEscribir ? 'Editar' : 'Ver detalle'}
          </DropdownMenuItem>
          {puedeEscribir && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setDeleteOpen(true)}
                className='text-destructive focus:text-destructive'
              >
                <Icons.trash className='mr-2 h-4 w-4' />
                Eliminar
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
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
    header: 'Cierre Comercial',
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
    size: 50,
    cell: ({ row }) => <InstructivoCellAction instructivo={row.original} />,
  },
]
