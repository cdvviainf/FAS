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
import { recepcionesService } from '../service'
import { recepcionesKeys } from '../queries'
import type { RecepcionListItem } from '../types'
import { ORIGEN_RECEPCION_LABELS, ESTADO_RECEPCION_LABELS } from '../types'
import { usePuedeEscribir } from '@/hooks/use-item-acceso'

const ITEM = 'COMPRAS_RECEPCION'

const ORIGEN_VARIANT: Record<string, 'default' | 'secondary' | 'outline'> = {
  COMPRA: 'default',
  PROCESO: 'outline',
}

const ESTADO_VARIANT: Record<string, 'secondary' | 'default' | 'destructive'> = {
  CARGADA: 'secondary',
  VALIDADA: 'default',
  RECHAZADA: 'destructive',
}

function RecepcionCellAction({ recepcion }: { recepcion: RecepcionListItem }) {
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [reabrirOpen, setReabrirOpen] = useState(false)
  // Validada (2026-11-11): se puede eliminar o reabrir si su fruta no está
  // comprometida (Embarque/Reclamo) — el backend lo verifica y explica si no.
  const esValidada = recepcion.estado === 'VALIDADA'
  const queryClient = useQueryClient()
  const router = useRouter()
  const puedeEscribir = usePuedeEscribir(ITEM)

  const deleteMutation = useMutation({
    mutationFn: () => recepcionesService.remove(recepcion.id),
    onSuccess: () => {
      toast.success('Recepción eliminada')
      setDeleteOpen(false)
      queryClient.invalidateQueries({ queryKey: recepcionesKeys.all })
    },
    onError: (e: Error) => toast.error(e.message || 'Error al eliminar la Recepción'),
  })

  const reabrirMutation = useMutation({
    mutationFn: () => recepcionesService.reabrir(recepcion.id),
    onSuccess: () => {
      toast.success('Recepción reabierta: puedes corregirla y cargar el Excel nuevamente')
      setReabrirOpen(false)
      queryClient.invalidateQueries({ queryKey: recepcionesKeys.all })
      router.push(`/dashboard/compras/recepciones/${recepcion.id}`)
    },
    onError: (e: Error) => toast.error(e.message || 'Error al reabrir la Recepción'),
  })

  return (
    <>
      <AlertModal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => deleteMutation.mutate()}
        loading={deleteMutation.isPending}
        {...(esValidada
          ? {
              title: `Eliminar Recepción ${recepcion.numero}`,
              description:
                'Se eliminarán también los pallets que queden en Stock y la Orden de Compra volverá a Emitida. Solo es posible si ningún pallet está en un Embarque o Reclamo.',
            }
          : {})}
      />
      <AlertModal
        isOpen={reabrirOpen}
        onClose={() => setReabrirOpen(false)}
        onConfirm={() => reabrirMutation.mutate()}
        loading={reabrirMutation.isPending}
        title={`Reabrir Recepción ${recepcion.numero}`}
        description='Se eliminarán los pallets que queden en Stock, la Recepción vuelve a Cargada (editable, para subir un Excel corregido) y la Orden de Compra vuelve a Emitida. Solo es posible si ningún pallet está en un Embarque o Reclamo.'
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
          <DropdownMenuItem onClick={() => router.push(`/dashboard/compras/recepciones/${recepcion.id}`)}>
            <Icons.edit className='mr-2 h-4 w-4' />
            {puedeEscribir ? 'Editar' : 'Ver detalle'}
          </DropdownMenuItem>
          {puedeEscribir && esValidada && (
            <DropdownMenuItem onClick={() => setReabrirOpen(true)}>
              <Icons.reopen className='mr-2 h-4 w-4' />
              Reabrir para recargar
            </DropdownMenuItem>
          )}
          {puedeEscribir && (recepcion.editable || esValidada) && (
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

export const recepcionColumns: ColumnDef<RecepcionListItem>[] = [
  {
    id: 'numero',
    accessorKey: 'numero',
    header: ({ column }) => <DataTableColumnHeader column={column} title='N° Recepción' />,
    cell: ({ cell }) => <span className='font-mono text-sm'>{cell.getValue<string>()}</span>,
    size: 130,
  },
  {
    id: 'planta',
    header: 'Planta',
    cell: ({ row }) => (
      <div>
        <p className='font-medium'>{row.original.planta.descripcion}</p>
        <p className='text-xs text-muted-foreground'>{row.original.planta.razonSocial}</p>
      </div>
    ),
  },
  {
    id: 'origen',
    accessorKey: 'origen',
    header: 'Origen',
    cell: ({ cell }) => {
      const origen = cell.getValue<keyof typeof ORIGEN_RECEPCION_LABELS>()
      return <Badge variant={ORIGEN_VARIANT[origen]}>{ORIGEN_RECEPCION_LABELS[origen]}</Badge>
    },
    size: 120,
  },
  {
    id: 'ordenCompra',
    header: 'Orden de Compra',
    cell: ({ row }) => (
      <span className='text-sm'>{row.original.ordenCompra ? row.original.ordenCompra.numero : '—'}</span>
    ),
    size: 140,
  },
  {
    id: 'estado',
    accessorKey: 'estado',
    header: 'Estado',
    cell: ({ cell }) => {
      const estado = cell.getValue<keyof typeof ESTADO_RECEPCION_LABELS>()
      return <Badge variant={ESTADO_VARIANT[estado]}>{ESTADO_RECEPCION_LABELS[estado]}</Badge>
    },
    size: 100,
  },
  {
    id: 'creadoEn',
    accessorKey: 'creadoEn',
    header: ({ column }) => <DataTableColumnHeader column={column} title='Fecha' />,
    cell: ({ cell }) => <span className='text-sm'>{new Date(cell.getValue<string>()).toLocaleDateString('es-CL')}</span>,
    size: 110,
  },
  {
    id: 'actions',
    size: 50,
    cell: ({ row }) => <RecepcionCellAction recepcion={row.original} />,
  },
]
