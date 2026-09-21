'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Icons } from '@/components/icons'
import { usePuedeEscribir } from '@/hooks/use-item-acceso'
import { DocumentoPreviewDialog } from '@/features/documentos/components/documento-preview-dialog'
import { movimientosService } from '../service'
import { ESTADO_MOVIMIENTO_LABELS } from '../types'
import type { Movimiento, EstadoMovimiento } from '../types'

const ITEM = 'OPER_MATERIALES'

const ESTADO_VARIANT: Record<EstadoMovimiento, 'secondary' | 'default'> = {
  BORRADOR: 'secondary',
  CONFIRMADO: 'default',
}

const fmt = new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium', timeZone: 'America/Santiago' })

function MovimientoCellAction({ movimiento }: { movimiento: Movimiento }) {
  const router = useRouter()
  const puedeEscribir = usePuedeEscribir(ITEM)
  const [pdfOpen, setPdfOpen] = useState(false)

  const puedeEmitirGuia = movimiento.tipoMovimiento.emiteDTE && movimiento.estado === 'CONFIRMADO'

  // Fase 1 (2026-09-21): solo llega hasta el DTE temporal de LibreDTE — sin
  // folio/PDF todavía (ver DocumentoDte en fas-api). Por eso no hay badge de
  // estado persistente ni descarga: el resultado se muestra por toast.
  const emitirGuiaMutation = useMutation({
    mutationFn: () => movimientosService.emitirGuiaDespacho(movimiento.id),
    onSuccess: ({ data }) => {
      if (data.estado === 'TEMPORAL_CREADO') {
        toast.success(`Guía de Despacho: DTE temporal creado en LibreDTE (código ${data.libredteCodigoTemporal})`)
      } else if (data.estado === 'EMITIENDO') {
        toast.info('Ya hay una emisión en curso para este movimiento — intenta de nuevo en un momento')
      } else {
        toast.error(data.errorMensaje || 'LibreDTE rechazó la Guía de Despacho')
      }
    },
    onError: (e: Error) => toast.error(e.message || 'Error al emitir la Guía de Despacho'),
  })

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant='ghost' className='h-8 w-8 p-0'>
            <span className='sr-only'>Abrir menú</span>
            <Icons.ellipsis className='h-4 w-4' />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end'>
          <DropdownMenuLabel>Acciones</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => router.push(`/dashboard/operaciones/movimientos/${movimiento.id}`)}>
            <Icons.edit className='mr-2 h-4 w-4' />
            {puedeEscribir && movimiento.estado === 'BORRADOR' ? 'Editar' : 'Ver detalle'}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setPdfOpen(true)}>
            <Icons.download className='mr-2 h-4 w-4' />
            Descargar PDF
          </DropdownMenuItem>
          {puedeEmitirGuia && puedeEscribir && (
            <DropdownMenuItem disabled={emitirGuiaMutation.isPending} onClick={() => emitirGuiaMutation.mutate()}>
              <Icons.post className='mr-2 h-4 w-4' />
              Emitir Guía de Despacho
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <DocumentoPreviewDialog
        tipo='movimiento'
        id={movimiento.id}
        titulo={`Movimiento ${movimiento.id}`}
        open={pdfOpen}
        onOpenChange={setPdfOpen}
        puedeEmitir={false}
      />
    </>
  )
}

export const movimientoColumns: ColumnDef<Movimiento>[] = [
  { id: 'fecha', header: 'Fecha', cell: ({ row }) => fmt.format(new Date(row.original.fechaMovimiento)) },
  { id: 'tipo', header: 'Tipo', cell: ({ row }) => <Badge variant='outline'>{row.original.tipoMovimiento.descripcion}</Badge> },
  { id: 'clase', header: 'Clase', cell: ({ row }) => row.original.tipoMovimiento.clase },
  {
    id: 'bodegas',
    header: 'Bodegas',
    cell: ({ row }) => {
      const o = row.original.bodegaOrigen?.descripcion
      const d = row.original.bodegaDestino?.descripcion
      if (o && d) return `${o} → ${d}`
      return o ?? d ?? '—'
    },
  },
  { id: 'entidad', header: 'Entidad', cell: ({ row }) => row.original.entidad?.descripcion ?? '—' },
  { id: 'lineas', header: 'Líneas', cell: ({ row }) => row.original.detalle.length },
  {
    id: 'estado',
    header: 'Estado',
    cell: ({ row }) => <Badge variant={ESTADO_VARIANT[row.original.estado]}>{ESTADO_MOVIMIENTO_LABELS[row.original.estado]}</Badge>,
  },
  {
    id: 'actions',
    size: 50,
    cell: ({ row }) => <MovimientoCellAction movimiento={row.original} />,
  },
]
