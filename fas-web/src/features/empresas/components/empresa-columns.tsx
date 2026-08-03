'use client'

import type { ColumnDef } from '@tanstack/react-table'
import { DataTableColumnHeader } from '@/components/ui/table/data-table-column-header'
import { Badge } from '@/components/ui/badge'
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
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { empresasService } from '../service'
import { empresasKeys } from '../queries'
import type { EmpresaListItem } from '../types'

function EmpresaCellAction({ empresa }: { empresa: EmpresaListItem }) {
  const [deleteOpen, setDeleteOpen] = useState(false)
  const queryClient = useQueryClient()
  const router = useRouter()

  const deleteMutation = useMutation({
    mutationFn: () => empresasService.remove(empresa.id),
    onSuccess: () => {
      toast.success('Empresa eliminada')
      setDeleteOpen(false)
      queryClient.invalidateQueries({ queryKey: empresasKeys.all })
      queryClient.invalidateQueries({ queryKey: ['config', 'me', 'empresas'] })
    },
    onError: (e: Error) => toast.error(e.message || 'Error al eliminar la empresa'),
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
          <DropdownMenuItem onClick={() => router.push(`/dashboard/configuracion/empresas/${empresa.id}`)}>
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

export const empresaColumns: ColumnDef<EmpresaListItem>[] = [
  {
    id: 'codigo',
    accessorKey: 'codigo',
    header: ({ column }) => <DataTableColumnHeader column={column} title='Código' />,
    cell: ({ cell }) => <span className='font-mono text-sm'>{cell.getValue<string>()}</span>,
    size: 100,
  },
  {
    id: 'razonSocial',
    accessorKey: 'razonSocial',
    header: ({ column }) => <DataTableColumnHeader column={column} title='Razón Social' />,
    cell: ({ row }) => (
      <div>
        <p className='font-medium'>{row.original.razonSocial}</p>
        {row.original.nombreFantasia && (
          <p className='text-xs text-muted-foreground'>{row.original.nombreFantasia}</p>
        )}
      </div>
    ),
  },
  {
    id: 'rut',
    header: 'RUT',
    cell: ({ row }) => <span className='text-sm'>{row.original.rut ?? '—'}</span>,
    size: 130,
  },
  {
    id: 'activo',
    accessorKey: 'activo',
    header: 'Estado',
    cell: ({ cell }) => (
      <Badge variant={cell.getValue<boolean>() ? 'default' : 'secondary'}>
        {cell.getValue<boolean>() ? 'Activa' : 'Inactiva'}
      </Badge>
    ),
    size: 90,
  },
  {
    id: 'actions',
    size: 50,
    cell: ({ row }) => <EmpresaCellAction empresa={row.original} />,
  },
]
