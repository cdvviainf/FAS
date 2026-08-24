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
import { notasVentaService } from '../service'
import { notasVentaKeys } from '../queries'
import { ESTADO_OC_CIERRE_LABELS } from '../types'
import type { NotaVentaListItem, NotaVentaListItemConEstadoOc } from '../types'
import { usePuedeEscribir } from '@/hooks/use-item-acceso'
import { formatFechaCorta } from '@/lib/format'
import { GenerarEmbarqueDialog } from '@/features/ventas/embarques/components/generar-embarque-dialog'
import { documentosService } from '@/features/documentos/service'
import { DocumentoPreviewDialog } from '@/features/documentos/components/documento-preview-dialog'

const ITEM = 'VENTAS_NV'
const ITEM_EMBARQUES = 'VENTAS_EMBARQUES'

function NotaVentaCellAction({ notaVenta }: { notaVenta: NotaVentaListItem }) {
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [embarqueOpen, setEmbarqueOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [descargando, setDescargando] = useState(false)
  const queryClient = useQueryClient()
  const router = useRouter()
  const puedeEscribir = usePuedeEscribir(ITEM)
  const puedeEscribirEmbarques = usePuedeEscribir(ITEM_EMBARQUES)

  async function descargarPdf() {
    setDescargando(true)
    try {
      await documentosService.abrirPdf('cierre-comercial', notaVenta.id)
    } catch {
      toast.error('No se pudo descargar el PDF')
    } finally {
      setDescargando(false)
    }
  }

  const deleteMutation = useMutation({
    mutationFn: () => notasVentaService.remove(notaVenta.id),
    onSuccess: () => {
      toast.success('Cierre Comercial eliminado')
      setDeleteOpen(false)
      queryClient.invalidateQueries({ queryKey: notasVentaKeys.all })
    },
    onError: (e: Error) => toast.error(e.message || 'Error al eliminar el Cierre Comercial'),
  })

  return (
    <>
      <AlertModal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => deleteMutation.mutate()}
        loading={deleteMutation.isPending}
      />
      <GenerarEmbarqueDialog notaVentaId={notaVenta.id} open={embarqueOpen} onOpenChange={setEmbarqueOpen} />
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant='ghost' className='h-8 w-8 p-0'>
            <span className='sr-only'>Abrir menú</span>
            <Icons.ellipsis className='h-4 w-4' />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end'>
          <DropdownMenuLabel>Acciones</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => router.push(`/dashboard/ventas/cierre/${notaVenta.id}`)}>
            <Icons.edit className='mr-2 h-4 w-4' />
            {puedeEscribir ? 'Editar' : 'Ver detalle'}
          </DropdownMenuItem>
          {puedeEscribirEmbarques && (
            <DropdownMenuItem onClick={() => setEmbarqueOpen(true)}>
              <Icons.post className='mr-2 h-4 w-4' />
              Generar Embarque
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => setPreviewOpen(true)}>
            <Icons.search className='mr-2 h-4 w-4' />
            Vista previa PDF
          </DropdownMenuItem>
          <DropdownMenuItem onClick={descargarPdf} disabled={descargando}>
            <Icons.download className='mr-2 h-4 w-4' />
            Descargar PDF
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
      <DocumentoPreviewDialog
        tipo='cierre-comercial'
        id={notaVenta.id}
        titulo={`Cierre Comercial ${notaVenta.folio}`}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        puedeEmitir={puedeEscribir}
      />
    </>
  )
}

export const notaVentaColumns: ColumnDef<NotaVentaListItemConEstadoOc>[] = [
  {
    id: 'folio',
    accessorKey: 'folio',
    header: ({ column }) => <DataTableColumnHeader column={column} title='Folio' />,
    cell: ({ cell }) => <span className='font-mono text-sm'>{cell.getValue<number>()}</span>,
    size: 90,
  },
  {
    id: 'fecha',
    accessorKey: 'fecha',
    header: ({ column }) => <DataTableColumnHeader column={column} title='Fecha' />,
    cell: ({ cell }) => <span className='text-sm'>{formatFechaCorta(cell.getValue<string>())}</span>,
    size: 110,
  },
  {
    id: 'cliente',
    header: 'Cliente',
    cell: ({ row }) => (
      <div>
        <p className='font-medium'>{row.original.cliente.descripcion}</p>
        <p className='text-xs text-muted-foreground'>{row.original.cliente.razonSocial}</p>
      </div>
    ),
  },
  {
    id: 'mercado',
    header: 'Mercado',
    cell: ({ row }) => <span className='text-sm'>{row.original.mercado.descripcion}</span>,
    size: 140,
  },
  {
    id: 'moneda',
    header: 'Moneda',
    cell: ({ row }) => <span className='text-sm'>{row.original.moneda.codigo}</span>,
    size: 90,
  },
  {
    id: 'estadoOc',
    accessorKey: 'estadoOc',
    header: 'Estado OC',
    cell: ({ row }) => (
      <Badge variant={row.original.estadoOc === 'COMPLETA' ? 'outline' : 'secondary'}>
        {ESTADO_OC_CIERRE_LABELS[row.original.estadoOc]}
      </Badge>
    ),
    size: 100,
  },
  {
    id: 'actions',
    size: 50,
    cell: ({ row }) => <NotaVentaCellAction notaVenta={row.original} />,
  },
]
