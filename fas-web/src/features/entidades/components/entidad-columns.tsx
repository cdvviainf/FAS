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
import { entidadesService } from '../service'
import { entidadesKeys } from '../queries'
import type { EntidadListItem } from '../types'
import { TIPO_ENTIDAD_LABELS } from '../types'

function EntidadCellAction({ entidad }: { entidad: EntidadListItem }) {
  const [deleteOpen, setDeleteOpen] = useState(false)
  const queryClient = useQueryClient()
  const router = useRouter()

  const deleteMutation = useMutation({
    mutationFn: () => entidadesService.remove(entidad.id),
    onSuccess: () => {
      toast.success('Entidad eliminada')
      setDeleteOpen(false)
      queryClient.invalidateQueries({ queryKey: entidadesKeys.all })
    },
    onError: (e: Error) => toast.error(e.message || 'Error al eliminar la entidad'),
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
          <DropdownMenuItem onClick={() => router.push(`/dashboard/configuracion/entidades/${entidad.id}`)}>
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

export const entidadColumns: ColumnDef<EntidadListItem>[] = [
  {
    id: 'codigo',
    accessorKey: 'codigo',
    header: ({ column }) => <DataTableColumnHeader column={column} title='Código' />,
    cell: ({ cell }) => <span className='font-mono text-sm'>{cell.getValue<string>()}</span>,
    size: 100,
  },
  {
    id: 'descripcion',
    accessorKey: 'descripcion',
    header: ({ column }) => <DataTableColumnHeader column={column} title='Nombre' />,
    cell: ({ row }) => (
      <div>
        <p className='font-medium'>{row.original.descripcion}</p>
        <p className='text-xs text-muted-foreground'>{row.original.razonSocial}</p>
      </div>
    ),
  },
  {
    id: 'pais',
    header: 'País',
    cell: ({ row }) => <span className='text-sm'>{row.original.pais.descripcion}</span>,
    size: 120,
  },
  {
    id: 'tipos',
    header: 'Tipos',
    cell: ({ row }) => (
      <div className='flex flex-wrap gap-1'>
        {row.original.tipos.slice(0, 3).map((t) => (
          <Badge key={t} variant='secondary' className='text-xs'>
            {TIPO_ENTIDAD_LABELS[t]}
          </Badge>
        ))}
        {row.original.tipos.length > 3 && (
          <Badge variant='outline' className='text-xs'>+{row.original.tipos.length - 3}</Badge>
        )}
      </div>
    ),
  },
  {
    id: 'activo',
    accessorKey: 'activo',
    header: 'Estado',
    cell: ({ cell }) => (
      <Badge variant={cell.getValue<boolean>() ? 'default' : 'secondary'}>
        {cell.getValue<boolean>() ? 'Activo' : 'Inactivo'}
      </Badge>
    ),
    size: 90,
  },
  {
    id: 'actions',
    size: 50,
    cell: ({ row }) => <EntidadCellAction entidad={row.original} />,
  },
]
