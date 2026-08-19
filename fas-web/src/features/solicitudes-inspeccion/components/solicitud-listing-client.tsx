'use client'

import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ColumnDef } from '@tanstack/react-table'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useQueryStates, parseAsInteger, parseAsString, parseAsStringEnum } from 'nuqs'
import { toast } from 'sonner'
import { DataTable } from '@/components/ui/table/data-table'
import { DataTableColumnHeader } from '@/components/ui/table/data-table-column-header'
import { DataTableSkeleton } from '@/components/ui/table/data-table-skeleton'
import { useDataTable } from '@/hooks/use-data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { AlertModal } from '@/components/modal/alert-modal'
import { Icons } from '@/components/icons'
import { usePuedeEscribir, usePuedeLeer } from '@/hooks/use-item-acceso'
import { authClient } from '@/lib/auth-client'
import { useTemporada } from '@/contexts/temporada-context'
import { solicitudesListOptions, solicitudesKeys } from '../queries'
import { solicitudesService } from '../service'
import { ESTADO_LABELS } from '../types'
import type { SolicitudInspeccion, EstadoSolicitud, TipoInspeccion } from '../types'
import { SolicitudCerrarDialog } from './solicitud-cerrar-dialog'
import { SolicitudDetalleDialog } from './solicitud-detalle-dialog'
import { documentosService } from '@/features/documentos/service'
import { DocumentoPreviewDialog } from '@/features/documentos/components/documento-preview-dialog'

const fmt = new Intl.DateTimeFormat('es-CL', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'America/Santiago',
})

const estadoVariant: Record<EstadoSolicitud, 'secondary' | 'default' | 'outline' | 'destructive'> = {
  PENDIENTE: 'secondary',
  NOTIFICADA: 'default',
  APROBADA: 'outline',
  RECHAZADA: 'destructive',
  OBJETADA: 'destructive',
}

interface SolicitudListingClientProps {
  tipoInspeccion?: TipoInspeccion
  // Determina el set de acciones, no solo el permiso (2026-08-10, ver
  // Docs/Hallazgos/solicitud-inspeccion.md): Compras gestiona por completo
  // (ingresar/editar/notificar/cerrar/eliminar), Calidad solo ve y cierra.
  contexto?: 'COMPRAS' | 'CALIDAD'
}

export function SolicitudListingClient({ tipoInspeccion, contexto = 'CALIDAD' }: SolicitudListingClientProps = {}) {
  const esCompras = contexto === 'COMPRAS'
  const ITEM = esCompras ? 'COMPRAS_SOLICITUDES' : 'CAL_SOLICITUDES'
  const basePath = esCompras ? '/dashboard/compras/solicitudes' : '/dashboard/calidad/solicitudes'
  const queryClient = useQueryClient()
  const router = useRouter()
  const puedeEscribir = usePuedeEscribir(ITEM)
  // Cerrar es la única acción que el backend acepta con TOTAL/LECTURA en
  // CUALQUIERA de los dos ítems (tieneNivelTotal() en solicitudes.controller.ts
  // — Compras y Calidad comparten el recurso), independiente del contexto de
  // la pantalla actual (IMP-QA-R1-002). El resto de acciones sigue acotado
  // al ítem del contexto (esCompras).
  const puedeEscribirCompras = usePuedeEscribir('COMPRAS_SOLICITUDES')
  const puedeEscribirCalidad = usePuedeEscribir('CAL_SOLICITUDES')
  const puedeLeerCompras = usePuedeLeer('COMPRAS_SOLICITUDES')
  const puedeLeerCalidad = usePuedeLeer('CAL_SOLICITUDES')
  const tieneTotalEnCualquiera = puedeEscribirCompras || puedeEscribirCalidad
  const tieneLecturaEnCualquiera = puedeLeerCompras || puedeLeerCalidad
  const { data: session } = authClient.useSession()
  const currentUserId = session?.user?.id
  const { temporada } = useTemporada()

  const [params, setParams] = useQueryStates({
    page: parseAsInteger.withDefault(1),
    perPage: parseAsInteger.withDefault(20),
    q: parseAsString,
    estado: parseAsStringEnum<EstadoSolicitud>(['PENDIENTE', 'NOTIFICADA', 'APROBADA', 'RECHAZADA', 'OBJETADA']),
  })

  // Dialog state
  const [cerrarItem, setCerrarItem] = useState<SolicitudInspeccion | undefined>()
  const [detalleItem, setDetalleItem] = useState<SolicitudInspeccion | undefined>()
  const [deleteItem, setDeleteItem] = useState<SolicitudInspeccion | undefined>()
  const [pdfItem, setPdfItem] = useState<SolicitudInspeccion | undefined>()
  const [descargandoId, setDescargandoId] = useState<number | null>(null)

  const descargarPdf = useCallback(async (id: number) => {
    setDescargandoId(id)
    try {
      await documentosService.abrirPdf('solicitud-inspeccion', id)
    } catch {
      toast.error('No se pudo descargar el PDF')
    } finally {
      setDescargandoId(null)
    }
  }, [])

  const filters = {
    page: params.page,
    limit: params.perPage,
    ...(tipoInspeccion ? { tipoInspeccion } : {}),
    ...(params.q ? { q: params.q } : {}),
    ...(params.estado ? { estado: params.estado } : {}),
    ...(temporada ? { temporadaId: temporada.id } : {}),
  }

  const { data, isPending } = useQuery(solicitudesListOptions(filters))

  const notificarMutation = useMutation({
    mutationFn: (id: number) => solicitudesService.notificar(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: solicitudesKeys.all })
      toast.success('Solicitud notificada por correo a los asignados')
    },
    onError: (e: Error) => toast.error(e.message || 'Error al notificar'),
  })

  const reabrirMutation = useMutation({
    mutationFn: (id: number) => solicitudesService.reabrir(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: solicitudesKeys.all })
      toast.success('Solicitud reabierta')
    },
    onError: (e: Error) => toast.error(e.message || 'Error al reabrir'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => solicitudesService.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: solicitudesKeys.all })
      toast.success('Solicitud eliminada')
      setDeleteItem(undefined)
    },
    onError: (e: Error) => toast.error(e.message || 'Error al eliminar'),
  })

  const columns = useMemo<ColumnDef<SolicitudInspeccion>[]>(() => [
    {
      accessorKey: 'codigo',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Código' />,
      cell: ({ row }) => <span className='font-medium'>{row.original.codigo}</span>,
    },
    {
      id: 'productor',
      header: 'Productor',
      cell: ({ row }) => row.original.entidadProductor.descripcion,
    },
    {
      id: 'fechaHora',
      header: 'Fecha visita',
      cell: ({ row }) => fmt.format(new Date(row.original.fechaHora)),
    },
    {
      accessorKey: 'estado',
      header: 'Estado',
      cell: ({ row }) => (
        <Badge variant={estadoVariant[row.original.estado]}>{ESTADO_LABELS[row.original.estado]}</Badge>
      ),
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const s = row.original
        // Máquina de estados (QAS-SI-003): notificar solo PENDIENTE, cerrar solo NOTIFICADA
        const esPendiente = s.estado === 'PENDIENTE'
        const esNotificada = s.estado === 'NOTIFICADA'
        const esCerrada = s.estado === 'APROBADA' || s.estado === 'RECHAZADA' || s.estado === 'OBJETADA'
        // QAS-SI-007: un asignado ACUDIR con solo LECTURA también puede cerrar
        const esInspectorAcudir = s.asignados.some((a) => a.usuarioId === currentUserId && a.funcion === 'ACUDIR')
        const puedeCerrar = esNotificada && (tieneTotalEnCualquiera || (esInspectorAcudir && tieneLecturaEnCualquiera))
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
              <DropdownMenuItem onClick={() => setDetalleItem(s)}>
                <Icons.search className='mr-2 h-4 w-4' /> Ver detalle
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setPdfItem(s)}>
                <Icons.search className='mr-2 h-4 w-4' /> Vista previa PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => descargarPdf(s.id)} disabled={descargandoId === s.id}>
                <Icons.download className='mr-2 h-4 w-4' /> Descargar PDF
              </DropdownMenuItem>

              {/* Ingresar/editar/notificar/eliminar/reabrir: exclusivo de
                  Compras — Calidad quedó restringida a ver+cerrar. */}
              {esCompras && puedeEscribir && esPendiente && (
                <DropdownMenuItem onClick={() => notificarMutation.mutate(s.id)}>
                  <Icons.notification className='mr-2 h-4 w-4' /> Notificar
                </DropdownMenuItem>
              )}
              {esCompras && puedeEscribir && !esCerrada && (
                <DropdownMenuItem onClick={() => router.push(`${basePath}/${s.id}`)}>
                  <Icons.edit className='mr-2 h-4 w-4' /> Editar
                </DropdownMenuItem>
              )}
              {puedeCerrar && (
                <DropdownMenuItem onClick={() => setCerrarItem(s)}>
                  <Icons.check className='mr-2 h-4 w-4' /> Cerrar inspección
                </DropdownMenuItem>
              )}
              {esCompras && puedeEscribir && !esCerrada && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className='text-destructive focus:text-destructive'
                    onClick={() => setDeleteItem(s)}
                  >
                    <Icons.trash className='mr-2 h-4 w-4' /> Eliminar
                  </DropdownMenuItem>
                </>
              )}
              {esCompras && puedeEscribir && esCerrada && (
                <DropdownMenuItem onClick={() => reabrirMutation.mutate(s.id)}>
                  <Icons.reopen className='mr-2 h-4 w-4' /> Reabrir
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ], [puedeEscribir, tieneTotalEnCualquiera, tieneLecturaEnCualquiera, currentUserId, notificarMutation, reabrirMutation, esCompras, basePath, router, descargarPdf, descargandoId])

  const pageCount = data ? Math.ceil(data.meta.total / params.perPage) : 0
  const { table } = useDataTable({
    data: data?.data ?? [],
    columns,
    pageCount,
    shallow: true,
    debounceMs: 500,
    initialState: { columnPinning: { right: ['actions'] } },
  })

  if (isPending) return <DataTableSkeleton columnCount={5} rowCount={10} />

  return (
    <div className='flex flex-1 flex-col space-y-3'>
      <div className='flex flex-wrap items-center gap-2'>
        <Input
          placeholder='Buscar código, productor...'
          value={params.q ?? ''}
          onChange={(e) => setParams({ q: e.target.value || null, page: 1 })}
          className='h-9 w-[260px]'
        />
        <Select
          value={params.estado ?? 'all'}
          onValueChange={(v) => setParams({ estado: v === 'all' ? null : (v as EstadoSolicitud), page: 1 })}
        >
          <SelectTrigger className='h-9 w-[170px]'>
            <SelectValue placeholder='Todos los estados' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>Todos los estados</SelectItem>
            <SelectItem value='PENDIENTE'>Pendiente</SelectItem>
            <SelectItem value='NOTIFICADA'>Notificada</SelectItem>
            <SelectItem value='APROBADA'>Aprobada</SelectItem>
            <SelectItem value='RECHAZADA'>Rechazada</SelectItem>
            <SelectItem value='OBJETADA'>Objetada</SelectItem>
          </SelectContent>
        </Select>
        <div className='flex-1' />
        {esCompras && puedeEscribir && (
          <Button onClick={() => router.push(`${basePath}/nueva`)} disabled={!temporada}>
            <Icons.add className='mr-1 h-4 w-4' /> Nueva solicitud
          </Button>
        )}
      </div>

      {!temporada && (
        <p className='text-sm text-muted-foreground'>
          Selecciona una temporada activa en la barra superior para crear solicitudes.
        </p>
      )}

      <DataTable table={table} />

      {/* Dialogs */}
      {cerrarItem && (
        <SolicitudCerrarDialog
          solicitud={cerrarItem}
          open={!!cerrarItem}
          onOpenChange={(v) => !v && setCerrarItem(undefined)}
        />
      )}
      {detalleItem && (
        <SolicitudDetalleDialog
          solicitud={detalleItem}
          open={!!detalleItem}
          onOpenChange={(v) => !v && setDetalleItem(undefined)}
        />
      )}
      {pdfItem && (
        <DocumentoPreviewDialog
          tipo='solicitud-inspeccion'
          id={pdfItem.id}
          titulo={`Solicitud de Inspección ${pdfItem.codigo}`}
          open={!!pdfItem}
          onOpenChange={(v) => !v && setPdfItem(undefined)}
          controlCopia={false}
        />
      )}
      <AlertModal
        isOpen={!!deleteItem}
        onClose={() => setDeleteItem(undefined)}
        onConfirm={() => deleteItem && deleteMutation.mutate(deleteItem.id)}
        loading={deleteMutation.isPending}
        title='Eliminar solicitud'
        description={
          deleteItem?.estado === 'NOTIFICADA'
            ? 'Esta solicitud ya fue notificada. Al eliminarla se avisará automáticamente a los asignados. ¿Continuar?'
            : '¿Eliminar esta solicitud de inspección?'
        }
      />
    </div>
  )
}
