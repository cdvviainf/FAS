'use client'

import { DataTableColumnHeader } from '@/components/ui/table/data-table-column-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { AlertModal } from '@/components/modal/alert-modal'
import { Icons } from '@/components/icons'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ColumnDef } from '@tanstack/react-table'
import { perfilesService } from '../service'
import { perfilesKeys } from '../queries'
import type { Perfil } from '../types'

function PerfilCellAction({ perfil }: { perfil: Perfil }) {
  const [deleteOpen, setDeleteOpen] = useState(false)
  const queryClient = useQueryClient()
  const router = useRouter()

  const deleteMutation = useMutation({
    mutationFn: () => perfilesService.remove(perfil.id),
    onSuccess: () => {
      toast.success('Perfil eliminado')
      setDeleteOpen(false)
      queryClient.invalidateQueries({ queryKey: perfilesKeys.all })
    },
    onError: (e: Error) => toast.error(e.message || 'Error al eliminar el perfil'),
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
          <DropdownMenuItem onClick={() => router.push(`/dashboard/configuracion/perfiles/${perfil.id}`)}>
            <Icons.edit className='mr-2 h-4 w-4' />
            Editar
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setDeleteOpen(true)}
            className='text-destructive focus:text-destructive'
          >
            <Icons.trash className='mr-2 h-4 w-4' />
            Eliminar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}

export const perfilColumns: ColumnDef<Perfil>[] = [
  {
    id: 'codigo',
    accessorKey: 'codigo',
    header: ({ column }) => <DataTableColumnHeader column={column} title='Código' />,
    cell: ({ cell }) => (
      <span className='font-mono text-xs font-semibold'>{cell.getValue<string>()}</span>
    ),
    size: 100,
  },
  {
    id: 'descripcion',
    accessorKey: 'descripcion',
    header: ({ column }) => <DataTableColumnHeader column={column} title='Descripción' />,
    cell: ({ row }) => <span className='font-medium'>{row.original.descripcion}</span>,
  },
  {
    id: 'usuarios',
    header: 'Usuarios',
    size: 90,
    cell: ({ row }) => (
      <Badge variant='outline' className='text-xs'>
        {row.original._count?.usuarios ?? 0}
      </Badge>
    ),
  },
  {
    id: 'actions',
    size: 50,
    cell: ({ row }) => <PerfilCellAction perfil={row.original} />,
  },
]
