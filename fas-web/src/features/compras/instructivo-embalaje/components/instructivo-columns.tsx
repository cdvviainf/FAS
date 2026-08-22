'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTableColumnHeader } from '@/components/ui/table/data-table-column-header'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import { ESTADO_INSPECCION_LABELS, ESTADOS_INSPECCION_CON_VEREDICTO } from '../types'
import type { EstadoInspeccionProceso, InstructivoEmbalajeListItem } from '../types'
import { documentosService } from '@/features/documentos/service'
import { DocumentoPreviewDialog } from '@/features/documentos/components/documento-preview-dialog'

const ITEM = 'COMPRAS_INSTRUCTIVO'

const estadoVariant: Record<EstadoInspeccionProceso, 'secondary' | 'default' | 'outline' | 'destructive'> = {
  PENDIENTE: 'secondary',
  NOTIFICADA: 'default',
  APROBADA: 'outline',
  RECHAZADA: 'destructive',
  CERRADA: 'outline',
}

function InstructivoCellAction({ instructivo }: { instructivo: InstructivoEmbalajeListItem }) {
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [descargando, setDescargando] = useState(false)
  const queryClient = useQueryClient()
  const router = useRouter()
  const puedeEscribir = usePuedeEscribir(ITEM)
  // Congelado: una vez que la inspección de proceso tiene veredicto, el
  // backend rechaza PATCH/DELETE (409) — se ocultan esas acciones en vez de
  // dejar que el usuario las intente y choque con el error (compras.md §4.1).
  const estaCongelado = ESTADOS_INSPECCION_CON_VEREDICTO.includes(instructivo.estadoInspeccion)
  const puedeEditar = puedeEscribir && !estaCongelado

  async function descargarPdf() {
    setDescargando(true)
    try {
      await documentosService.abrirPdf('instructivo-embalaje', instructivo.id)
    } catch {
      toast.error('No se pudo descargar el PDF')
    } finally {
      setDescargando(false)
    }
  }

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
            {puedeEditar ? 'Editar' : 'Ver detalle'}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setPreviewOpen(true)}>
            <Icons.search className='mr-2 h-4 w-4' />
            Vista previa PDF
          </DropdownMenuItem>
          <DropdownMenuItem onClick={descargarPdf} disabled={descargando}>
            <Icons.download className='mr-2 h-4 w-4' />
            Descargar PDF
          </DropdownMenuItem>
          {puedeEditar && (
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
        tipo='instructivo-embalaje'
        id={instructivo.id}
        titulo={`Instructivo de Embalaje N° ${instructivo.numero}`}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        controlCopia={false}
        orientacion='landscape'
      />
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
    id: 'entidadProductor',
    header: 'Productor',
    cell: ({ row }) => (
      <div>
        <p className='font-medium'>{row.original.entidadProductor.descripcion}</p>
        <p className='text-xs text-muted-foreground'>{row.original.entidadProductor.razonSocial}</p>
      </div>
    ),
    size: 200,
  },
  {
    id: 'creadoEn',
    accessorKey: 'creadoEn',
    header: ({ column }) => <DataTableColumnHeader column={column} title='Emitido' />,
    cell: ({ cell }) => <span className='text-sm'>{new Date(cell.getValue<string>()).toLocaleString('es-CL')}</span>,
  },
  {
    id: 'estadoInspeccion',
    accessorKey: 'estadoInspeccion',
    header: 'Inspección de Proceso',
    cell: ({ row }) => (
      <Badge variant={estadoVariant[row.original.estadoInspeccion]}>
        {ESTADO_INSPECCION_LABELS[row.original.estadoInspeccion]}
      </Badge>
    ),
  },
  {
    id: 'actions',
    size: 50,
    cell: ({ row }) => <InstructivoCellAction instructivo={row.original} />,
  },
]
