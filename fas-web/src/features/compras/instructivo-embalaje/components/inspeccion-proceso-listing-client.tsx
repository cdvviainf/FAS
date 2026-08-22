'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useQueryStates, parseAsInteger, parseAsStringEnum } from 'nuqs'
import { toast } from 'sonner'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/ui/table/data-table'
import { DataTableColumnHeader } from '@/components/ui/table/data-table-column-header'
import { DataTableSkeleton } from '@/components/ui/table/data-table-skeleton'
import { useDataTable } from '@/hooks/use-data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { AlertModal } from '@/components/modal/alert-modal'
import { Icons } from '@/components/icons'
import { usePuedeEscribir } from '@/hooks/use-item-acceso'
import { instructivosEmbalajeListOptions, instructivosEmbalajeKeys } from '../queries'
import { instructivoEmbalajeService } from '../service'
import { ESTADO_INSPECCION_LABELS } from '../types'
import type { EstadoInspeccionProceso, InstructivoEmbalajeListItem } from '../types'
import { InspeccionProcesoDetalleDialog } from './inspeccion-proceso-detalle-dialog'
import { InspeccionProcesoVeredictoDialog } from './inspeccion-proceso-veredicto-dialog'

const ITEM_CALIDAD = 'CAL_SOLICITUDES'

const estadoVariant: Record<EstadoInspeccionProceso, 'secondary' | 'default' | 'outline' | 'destructive'> = {
  PENDIENTE: 'secondary',
  NOTIFICADA: 'default',
  APROBADA: 'outline',
  RECHAZADA: 'destructive',
  CERRADA: 'outline',
}

export function InspeccionProcesoListingClient() {
  const queryClient = useQueryClient()
  const puedeEscribir = usePuedeEscribir(ITEM_CALIDAD)

  const [params, setParams] = useQueryStates({
    page: parseAsInteger.withDefault(1),
    perPage: parseAsInteger.withDefault(20),
    estado: parseAsStringEnum<EstadoInspeccionProceso>(['PENDIENTE', 'NOTIFICADA', 'APROBADA', 'RECHAZADA', 'CERRADA']),
  })

  const [detalleId, setDetalleId] = useState<number | null>(null)
  const [veredictoItem, setVeredictoItem] = useState<{ instructivo: InstructivoEmbalajeListItem; veredicto: 'APROBAR' | 'RECHAZAR' } | null>(null)
  const [cerrarItem, setCerrarItem] = useState<InstructivoEmbalajeListItem | null>(null)

  const filters = {
    page: params.page,
    limit: params.perPage,
    ...(params.estado ? { estadoInspeccion: params.estado } : {}),
  }
  const { data, isPending } = useQuery(instructivosEmbalajeListOptions(filters))

  const notificarMutation = useMutation({
    mutationFn: (id: number) => instructivoEmbalajeService.notificarInspeccion(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: instructivosEmbalajeKeys.all })
      toast.success('Inspección de proceso notificada')
    },
    onError: (e: Error) => toast.error(e.message || 'Error al notificar'),
  })

  const cerrarMutation = useMutation({
    mutationFn: (id: number) => instructivoEmbalajeService.cerrarInspeccion(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: instructivosEmbalajeKeys.all })
      toast.success('Inspección de proceso cerrada')
      setCerrarItem(null)
    },
    onError: (e: Error) => toast.error(e.message || 'Error al cerrar'),
  })

  const columns = useMemo<ColumnDef<InstructivoEmbalajeListItem>[]>(() => [
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
      id: 'estadoInspeccion',
      accessorKey: 'estadoInspeccion',
      header: 'Estado',
      cell: ({ row }) => (
        <Badge variant={estadoVariant[row.original.estadoInspeccion]}>
          {ESTADO_INSPECCION_LABELS[row.original.estadoInspeccion]}
        </Badge>
      ),
    },
    {
      id: 'folios',
      header: 'Folios',
      cell: ({ row }) => <span className='text-sm'>{row.original._count?.folios ?? 0}</span>,
      size: 70,
    },
    {
      id: 'creadoEn',
      accessorKey: 'creadoEn',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Emitido' />,
      cell: ({ cell }) => <span className='text-sm'>{new Date(cell.getValue<string>()).toLocaleString('es-CL')}</span>,
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const inst = row.original
        const esPendiente = inst.estadoInspeccion === 'PENDIENTE'
        const puedeVeredicto = puedeEscribir && (inst.estadoInspeccion === 'PENDIENTE' || inst.estadoInspeccion === 'NOTIFICADA')
        const puedeCerrar = puedeEscribir && inst.estadoInspeccion === 'APROBADA'
        return (
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button variant='ghost' className='h-8 w-8 p-0'>
                <span className='sr-only'>Abrir menú</span>
                <Icons.ellipsis className='h-4 w-4' />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end'>
              <DropdownMenuLabel>Acciones</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => setDetalleId(inst.id)}>
                <Icons.search className='mr-2 h-4 w-4' /> Ver detalle
              </DropdownMenuItem>
              {puedeEscribir && esPendiente && (
                <DropdownMenuItem onClick={() => notificarMutation.mutate(inst.id)}>
                  <Icons.notification className='mr-2 h-4 w-4' /> Notificar
                </DropdownMenuItem>
              )}
              {puedeVeredicto && (
                <DropdownMenuItem onClick={() => setVeredictoItem({ instructivo: inst, veredicto: 'APROBAR' })}>
                  <Icons.check className='mr-2 h-4 w-4' /> Aprobar
                </DropdownMenuItem>
              )}
              {puedeVeredicto && (
                <DropdownMenuItem onClick={() => setVeredictoItem({ instructivo: inst, veredicto: 'RECHAZAR' })}>
                  <Icons.close className='mr-2 h-4 w-4' /> Rechazar
                </DropdownMenuItem>
              )}
              {puedeCerrar && (
                <DropdownMenuItem onClick={() => setCerrarItem(inst)}>
                  <Icons.check className='mr-2 h-4 w-4' /> Cerrar inspección
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ], [puedeEscribir, notificarMutation])

  const pageCount = data ? Math.ceil(data.meta.total / params.perPage) : 0
  const { table } = useDataTable({
    data: data?.data ?? [],
    columns,
    pageCount,
    shallow: true,
    debounceMs: 500,
    initialState: { columnPinning: { right: ['actions'] } },
  })

  if (isPending) return <DataTableSkeleton columnCount={6} rowCount={10} />

  return (
    <div className='flex flex-1 flex-col space-y-3'>
      <div className='flex flex-wrap items-center gap-2'>
        <Select
          value={params.estado ?? 'all'}
          onValueChange={(v) => setParams({ estado: v === 'all' ? null : (v as EstadoInspeccionProceso), page: 1 })}
        >
          <SelectTrigger className='h-9 w-[170px]'>
            <SelectValue placeholder='Todos los estados' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>Todos los estados</SelectItem>
            {(Object.keys(ESTADO_INSPECCION_LABELS) as EstadoInspeccionProceso[]).map((e) => (
              <SelectItem key={e} value={e}>{ESTADO_INSPECCION_LABELS[e]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable table={table} />

      {detalleId != null && (
        <InspeccionProcesoDetalleDialog
          instructivoId={detalleId}
          open={detalleId != null}
          onOpenChange={(v) => !v && setDetalleId(null)}
        />
      )}
      {veredictoItem && (
        <InspeccionProcesoVeredictoDialog
          instructivo={veredictoItem.instructivo}
          veredicto={veredictoItem.veredicto}
          open={!!veredictoItem}
          onOpenChange={(v) => !v && setVeredictoItem(null)}
        />
      )}
      <AlertModal
        isOpen={!!cerrarItem}
        onClose={() => setCerrarItem(null)}
        onConfirm={() => cerrarItem && cerrarMutation.mutate(cerrarItem.id)}
        loading={cerrarMutation.isPending}
        title='Cerrar inspección de proceso'
        description='¿Cerrar esta inspección de proceso? Debe tener al menos un folio cargado.'
      />
    </div>
  )
}
