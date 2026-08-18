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
import { ordenesCompraService } from '../service'
import { ordenesCompraKeys } from '../queries'
import type { OrdenCompraListItem } from '../types'
import { ESTADO_OC_LABELS } from '../types'
import { usePuedeEscribir } from '@/hooks/use-item-acceso'
import { formatFechaCorta } from '@/lib/format'

const ITEM = 'COMPRAS_OC'

const ESTADO_VARIANT: Record<string, 'secondary' | 'default' | 'outline'> = {
  BORRADOR: 'secondary',
  EMITIDA: 'default',
  RECEPCIONADA: 'outline',
}

function OrdenCompraCellAction({ orden }: { orden: OrdenCompraListItem }) {
  const [deleteOpen, setDeleteOpen] = useState(false)
  const queryClient = useQueryClient()
  const router = useRouter()
  const puedeEscribir = usePuedeEscribir(ITEM)

  const deleteMutation = useMutation({
    mutationFn: () => ordenesCompraService.remove(orden.id),
    onSuccess: () => {
      toast.success('Orden de Compra eliminada')
      setDeleteOpen(false)
      queryClient.invalidateQueries({ queryKey: ordenesCompraKeys.all })
    },
    onError: (e: Error) => toast.error(e.message || 'Error al eliminar la Orden de Compra'),
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
          <DropdownMenuItem onClick={() => router.push(`/dashboard/compras/ordenes/${orden.id}`)}>
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

export const ordenCompraColumns: ColumnDef<OrdenCompraListItem>[] = [
  {
    id: 'numero',
    accessorKey: 'numero',
    header: ({ column }) => <DataTableColumnHeader column={column} title='N° OC' />,
    cell: ({ cell }) => <span className='font-mono text-sm'>{cell.getValue<string>()}</span>,
    size: 120,
  },
  {
    id: 'fecha',
    accessorKey: 'fecha',
    header: ({ column }) => <DataTableColumnHeader column={column} title='Fecha' />,
    cell: ({ cell }) => <span className='text-sm'>{formatFechaCorta(cell.getValue<string>())}</span>,
    size: 110,
  },
  {
    id: 'productor',
    header: 'Productor',
    cell: ({ row }) => (
      <div>
        <p className='font-medium'>{row.original.entidadProductor.descripcion}</p>
        <p className='text-xs text-muted-foreground'>{row.original.entidadProductor.razonSocial}</p>
      </div>
    ),
  },
  {
    id: 'notaVenta',
    header: 'Cierre Comercial',
    cell: ({ row }) => (
      <span className='text-sm'>{row.original.notaVenta ? `Folio ${row.original.notaVenta.folio}` : '— (suelta)'}</span>
    ),
    size: 140,
  },
  {
    id: 'moneda',
    header: 'Moneda',
    cell: ({ row }) => <span className='text-sm'>{row.original.moneda.codigo}</span>,
    size: 90,
  },
  {
    id: 'estado',
    accessorKey: 'estado',
    header: 'Estado',
    cell: ({ cell }) => {
      const estado = cell.getValue<keyof typeof ESTADO_OC_LABELS>()
      return <Badge variant={ESTADO_VARIANT[estado]}>{ESTADO_OC_LABELS[estado]}</Badge>
    },
    size: 100,
  },
  {
    id: 'actions',
    size: 50,
    cell: ({ row }) => <OrdenCompraCellAction orden={row.original} />,
  },
]
