'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Icons } from '@/components/icons'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { DataTableColumnHeader } from '@/components/ui/table/data-table-column-header'
import { formatFechaCorta, semanaISO } from '@/lib/format'
import { documentosService } from '@/features/documentos/service'
import { embarquesService } from '../service'
import { ESTADO_EMBARQUE_LISTADO_LABELS } from '../types'
import type { Embarque, EstadoEmbarqueListado } from '../types'

// Abre el PDF del Cierre Comercial en pestaña nueva (vía blob con X-Empresa-Id,
// no navegación plana — mismo patrón que "Ver Cierre" en Proforma/Factura).
async function abrirCierreComercial(notaVentaId: number) {
  try {
    await documentosService.abrirPdf('cierre-comercial', notaVentaId)
  } catch (e) {
    toast.error((e as Error).message || 'No se pudo abrir el Cierre Comercial')
  }
}

async function abrirInstructivo(hijoId: number) {
  try {
    await documentosService.abrirPdf('instructivo-embarque', hijoId)
  } catch (e) {
    toast.error((e as Error).message || 'No se pudo abrir el Instructivo')
  }
}

async function abrirGuiaDespacho(embarqueId: number) {
  try {
    await embarquesService.abrirGuiaDespachoPdf(embarqueId)
  } catch (e) {
    toast.error((e as Error).message || 'No se pudo abrir la Guía de Despacho')
  }
}

// Descarga el Packing List GENERADO POR EL SISTEMA (reporte Excel), no los
// archivos subidos para la reconciliación (2026-10-27).
async function descargarPackingListSistema(embarqueId: number, numeroInstructivo: string) {
  try {
    await embarquesService.emitirPackingList(embarqueId, `packing-list-${numeroInstructivo}.xlsx`)
  } catch (e) {
    toast.error((e as Error).message || 'No se pudo generar el Packing List')
  }
}

// Menú de acciones por fila: ver detalle + descargar reportes asociados
// (Instructivo por planta y Packing List). El detalle (que trae esas listas)
// se carga de forma diferida al abrir el menú, para no pedirlo por cada fila.
function EmbarqueCellAction({ embarque }: { embarque: Embarque }) {
  const [open, setOpen] = useState(false)
  const { data: detalle, isLoading } = useQuery({
    queryKey: ['embarque-acciones', embarque.id],
    queryFn: () => embarquesService.getById(embarque.id),
    enabled: open,
    staleTime: 30_000,
  })
  const instructivos = detalle?.data.instructivosHijos ?? []

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant='ghost' size='icon' className='h-8 w-8'>
          <Icons.ellipsis className='h-4 w-4' />
          <span className='sr-only'>Abrir acciones</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='w-56'>
        <DropdownMenuItem asChild>
          <Link href={`/dashboard/ventas/embarques/${embarque.id}`}>
            <Icons.edit className='mr-2 h-4 w-4' /> Ver / editar
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuLabel>Instructivo</DropdownMenuLabel>
        {isLoading ? (
          <DropdownMenuItem disabled>Cargando…</DropdownMenuItem>
        ) : instructivos.length === 0 ? (
          <DropdownMenuItem disabled>Sin instructivos generados</DropdownMenuItem>
        ) : (
          instructivos.map((h) => (
            <DropdownMenuItem key={h.id} onSelect={(e) => { e.preventDefault(); abrirInstructivo(h.id) }}>
              <Icons.fileTypePdf className='mr-2 h-4 w-4' /> Instructivo {h.codigo}
            </DropdownMenuItem>
          ))
        )}

        <DropdownMenuSeparator />
        <DropdownMenuLabel>Packing List</DropdownMenuLabel>
        <DropdownMenuItem onSelect={(e) => { e.preventDefault(); descargarPackingListSistema(embarque.id, embarque.numeroInstructivo) }}>
          <Icons.fileTypeXls className='mr-2 h-4 w-4' /> Descargar Packing List
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

const ESTADO_BADGE_VARIANT: Record<EstadoEmbarqueListado, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  PENDIENTE: 'outline',
  SOLICITADA: 'secondary',
  CONFIRMADA: 'default',
  DESPACHADO: 'default',
  DESPACHO_ANULADO: 'destructive',
}

export const embarqueColumns: ColumnDef<Embarque>[] = [
  {
    id: 'numeroInstructivo',
    accessorKey: 'numeroInstructivo',
    header: ({ column }) => <DataTableColumnHeader column={column} title='Instructivo' />,
    cell: ({ cell }) => <span className='font-mono text-sm'>{cell.getValue<string>()}</span>,
  },
  {
    id: 'notaVenta',
    header: 'Cierre Com.',
    enableSorting: false,
    cell: ({ row }) => (
      <button
        type='button'
        onClick={() => abrirCierreComercial(row.original.notaVentaId)}
        className='text-sm text-primary hover:underline'
      >
        {row.original.notaVenta.folio}
      </button>
    ),
    size: 100,
  },
  {
    id: 'tipoVenta',
    header: 'Venta',
    enableSorting: false,
    cell: ({ row }) => {
      const tipo = row.original.notaVenta.tipoVenta
      if (!tipo) return <span className='text-muted-foreground text-xs'>—</span>
      return (
        <Badge variant={tipo === 'EXPORTACION' ? 'default' : 'secondary'}>
          {tipo === 'EXPORTACION' ? 'Exportación' : 'Nacional'}
        </Badge>
      )
    },
    size: 110,
  },
  {
    id: 'cliente',
    header: ({ column }) => <DataTableColumnHeader column={column} title='Cliente' />,
    cell: ({ row }) => <span className='text-sm'>{row.original.notaVenta.cliente?.descripcion ?? '—'}</span>,
  },
  {
    id: 'mercado',
    header: ({ column }) => <DataTableColumnHeader column={column} title='Mercado' />,
    cell: ({ row }) => <span className='text-sm'>{row.original.notaVenta.mercado?.descripcion ?? '—'}</span>,
    size: 140,
  },
  {
    id: 'puertoDestino',
    header: ({ column }) => <DataTableColumnHeader column={column} title='Puerto destino' />,
    cell: ({ row }) => <span className='text-sm'>{row.original.notaVenta.puertoDestino?.descripcion ?? '—'}</span>,
    size: 150,
  },
  {
    id: 'creadoEn',
    accessorKey: 'creadoEn',
    header: ({ column }) => <DataTableColumnHeader column={column} title='Creado' />,
    cell: ({ cell }) => <span className='text-sm'>{formatFechaCorta(cell.getValue<string>())}</span>,
    size: 110,
  },
  {
    id: 'semana',
    header: 'Semana',
    enableSorting: false,
    cell: ({ row }) => {
      const semana = semanaISO(row.original.creadoEn)
      return <span className='text-sm tabular-nums'>{semana ?? '—'}</span>
    },
    size: 80,
  },
  {
    id: 'estado',
    header: 'Estado',
    enableSorting: false,
    cell: ({ row }) => {
      const estado = row.original.estadoListado
      if (!estado) return <span className='text-muted-foreground text-xs'>—</span>
      return <Badge variant={ESTADO_BADGE_VARIANT[estado]}>{ESTADO_EMBARQUE_LISTADO_LABELS[estado]}</Badge>
    },
    size: 130,
  },
  {
    id: 'guiaDespacho',
    header: 'Guía de Despacho',
    enableSorting: false,
    cell: ({ row }) => {
      const guia = row.original.guiaDespacho
      // Link al PDF solo cuando la emitimos nosotros (DTE 52 con PDF disponible).
      if (guia?.pdfDisponible) {
        return (
          <button
            type='button'
            onClick={() => abrirGuiaDespacho(row.original.id)}
            className='text-primary inline-flex items-center gap-1 text-sm hover:underline'
          >
            <Icons.fileTypePdf className='h-3.5 w-3.5' />
            {guia.folio ? `Folio ${guia.folio}` : 'Ver PDF'}
          </button>
        )
      }
      // Emitida por un tercero: se muestra como referencia, sin PDF nuestro.
      if (row.original.guiaExternaNumero) {
        return <span className='text-muted-foreground text-xs'>Externa N° {row.original.guiaExternaNumero}</span>
      }
      return <span className='text-muted-foreground text-sm'>—</span>
    },
    size: 150,
  },
  {
    id: 'reclamo',
    header: 'Reclamo',
    enableSorting: false,
    cell: ({ row }) => {
      const tieneReclamo = (row.original._count?.reclamos ?? 0) > 0
      return tieneReclamo ? <Badge variant='destructive'>Sí</Badge> : <span className='text-muted-foreground text-sm'>No</span>
    },
    size: 90,
  },
  {
    id: 'actions',
    size: 50,
    cell: ({ row }) => <EmbarqueCellAction embarque={row.original} />,
  },
]
