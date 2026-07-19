'use client'

import { DataTableColumnHeader } from '@/components/ui/table/data-table-column-header'
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
import { usuariosService } from '../service'
import { usuariosKeys } from '../queries'
import type { Usuario } from '../types'

function UsuarioCellAction({ usuario }: { usuario: Usuario }) {
  const [deleteOpen, setDeleteOpen] = useState(false)
  const queryClient = useQueryClient()
  const router = useRouter()

  const deleteMutation = useMutation({
    mutationFn: () => usuariosService.remove(usuario.id),
    onSuccess: () => {
      toast.success('Usuario eliminado')
      setDeleteOpen(false)
      queryClient.invalidateQueries({ queryKey: usuariosKeys.all })
    },
    onError: (e: Error) => toast.error(e.message || 'Error al eliminar el usuario'),
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
          <DropdownMenuItem onClick={() => router.push(`/dashboard/configuracion/usuarios/${usuario.id}`)}>
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

export const usuarioColumns: ColumnDef<Usuario>[] = [
  {
    id: 'nombre',
    accessorKey: 'nombre',
    header: ({ column }) => <DataTableColumnHeader column={column} title='Nombre' />,
    cell: ({ row }) => (
      <div className='flex items-center gap-2'>
        <span className='font-medium'>{row.original.nombre}</span>
      </div>
    ),
  },
  {
    id: 'email',
    accessorKey: 'email',
    header: ({ column }) => <DataTableColumnHeader column={column} title='Email' />,
    cell: ({ cell }) => (
      <span className='text-sm text-muted-foreground font-mono'>{cell.getValue<string>()}</span>
    ),
  },
  {
    id: 'perfil',
    header: 'Perfil',
    cell: ({ row }) => (
      <span className='text-sm'>{row.original.perfil.descripcion}</span>
    ),
  },
  {
    id: 'whatsapp',
    accessorKey: 'whatsapp',
    header: 'WhatsApp',
    enableSorting: false,
    cell: ({ cell }) => (
      <span className='text-sm text-muted-foreground'>{cell.getValue<string>() ?? '—'}</span>
    ),
  },
  {
    id: 'actions',
    size: 50,
    cell: ({ row }) => <UsuarioCellAction usuario={row.original} />,
  },
]
