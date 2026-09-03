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
import { ordenesCompraMaterialService } from '../service'
import { ordenesCompraMaterialKeys } from '../queries'
import type { OrdenCompraMaterialListItem } from '../types'
import { ESTADO_OCM_LABELS } from '../types'
import { usePuedeEscribir } from '@/hooks/use-item-acceso'
import { formatFechaCorta } from '@/lib/format'
import { documentosService } from '@/features/documentos/service'
import { DocumentoPreviewDialog } from '@/features/documentos/components/documento-preview-dialog'

const ITEM = 'MATERIALES_OC'

const ESTADO_VARIANT: Record<string, 'secondary' | 'default' | 'outline'> = {
  BORRADOR: 'secondary',
  EMITIDA: 'default',
  RECEPCIONADA: 'outline',
}

function OrdenCompraMaterialCellAction({ orden }: { orden: OrdenCompraMaterialListItem }) {
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [descargando, setDescargando] = useState(false)
  const queryClient = useQueryClient()
  const router = useRouter()
  const puedeEscribir = usePuedeEscribir(ITEM)

  async function descargarPdf() {
    setDescargando(true)
    try {
      await documentosService.abrirPdf('orden-compra-material', orden.id)
    } catch {
      toast.error('No se pudo descargar el PDF')
    } finally {
      setDescargando(false)
    }
  }

  const deleteMutation = useMutation({
    mutationFn: () => ordenesCompraMaterialService.remove(orden.id),
    onSuccess: () => {
      toast.success('Orden de Compra de Materiales eliminada')
      setDeleteOpen(false)
      queryClient.invalidateQueries({ queryKey: ordenesCompraMaterialKeys.all })
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
          <DropdownMenuItem onClick={() => router.push(`/dashboard/operaciones/materiales/ordenes-compra/${orden.id}`)}>
            <Icons.edit className='mr-2 h-4 w-4' />
            {puedeEscribir ? 'Editar' : 'Ver detalle'}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setPreviewOpen(true)}>
            <Icons.search className='mr-2 h-4 w-4' />
            Vista previa PDF
          </DropdownMenuItem>
          <DropdownMenuItem onClick={descargarPdf} disabled={descargando}>
            <Icons.download className='mr-2 h-4 w-4' />
            Descargar PDF
          </DropdownMenuItem>
          {puedeEscribir && orden.estado !== 'RECEPCIONADA' && (
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
      <DocumentoPreviewDialog
        tipo='orden-compra-material'
        id={orden.id}
        titulo={`Orden de Compra de Materiales ${orden.numero}`}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        puedeEmitir={puedeEscribir}
      />
    </>
  )
}

export const ordenCompraMaterialColumns: ColumnDef<OrdenCompraMaterialListItem>[] = [
  {
    id: 'numero',
    accessorKey: 'numero',
    header: ({ column }) => <DataTableColumnHeader column={column} title='N° OCM' />,
    cell: ({ cell }) => <span className='font-mono text-sm'>{cell.getValue<string>()}</span>,
    size: 130,
  },
  {
    id: 'fecha',
    accessorKey: 'fecha',
    header: ({ column }) => <DataTableColumnHeader column={column} title='Fecha' />,
    cell: ({ cell }) => <span className='text-sm'>{formatFechaCorta(cell.getValue<string>())}</span>,
    size: 110,
  },
  {
    id: 'proveedor',
    header: 'Proveedor',
    cell: ({ row }) => (
      <div>
        <p className='font-medium'>{row.original.entidadProveedor.descripcion}</p>
        <p className='text-xs text-muted-foreground'>{row.original.entidadProveedor.razonSocial}</p>
      </div>
    ),
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
      const estado = cell.getValue<keyof typeof ESTADO_OCM_LABELS>()
      return <Badge variant={ESTADO_VARIANT[estado]}>{ESTADO_OCM_LABELS[estado]}</Badge>
    },
    size: 100,
  },
  {
    id: 'actions',
    size: 50,
    cell: ({ row }) => <OrdenCompraMaterialCellAction orden={row.original} />,
  },
]
