'use client'

import { useState } from 'react'
import { getISOWeek } from 'date-fns'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Icons } from '@/components/icons'
import { usePuedeEscribir } from '@/hooks/use-item-acceso'
import { formatFechaCorta } from '@/lib/format'
import { instructivoEmbalajeService } from '../service'
import { instructivoEmbalajeDetailOptions, instructivosEmbalajeKeys } from '../queries'
import { ESTADO_INSPECCION_LABELS } from '../types'

const ITEM_CALIDAD = 'CAL_SOLICITUDES'

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className='grid grid-cols-[150px_1fr] gap-2 text-sm'>
      <span className='text-muted-foreground'>{label}</span>
      <span>{children}</span>
    </div>
  )
}

interface InspeccionProcesoDetalleDialogProps {
  instructivoId: number
  open: boolean
  onOpenChange: (open: boolean) => void
}

// El listado trae solo campos livianos (sin `detalle`/`folios`) — este
// diálogo consulta el detalle completo por id al abrirse.
export function InspeccionProcesoDetalleDialog({ instructivoId, open, onOpenChange }: InspeccionProcesoDetalleDialogProps) {
  const queryClient = useQueryClient()
  const puedeEscribirCalidad = usePuedeEscribir(ITEM_CALIDAD)
  const [textareaFolios, setTextareaFolios] = useState('')
  const { data, isPending } = useQuery({ ...instructivoEmbalajeDetailOptions(instructivoId), enabled: open })

  // Todos los hooks van antes de este punto (reglas de hooks) — el return
  // condicional por datos aún no cargados va después de declararlos todos.
  const agregarFoliosMutation = useMutation({
    mutationFn: (folios: string[]) => instructivoEmbalajeService.agregarFolios(instructivoId, folios),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: instructivosEmbalajeKeys.all })
      toast.success('Folios cargados')
      setTextareaFolios('')
    },
    onError: (e: Error) => toast.error(e.message || 'Error al cargar los folios'),
  })

  const quitarFolioMutation = useMutation({
    mutationFn: (folioId: number) => instructivoEmbalajeService.quitarFolio(instructivoId, folioId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: instructivosEmbalajeKeys.all })
      toast.success('Folio quitado')
    },
    onError: (e: Error) => toast.error(e.message || 'Error al quitar el folio'),
  })

  if (isPending || !data) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className='max-w-2xl'>
          <p className='text-sm text-muted-foreground'>Cargando…</p>
        </DialogContent>
      </Dialog>
    )
  }

  const d = data.data
  const semanaIso = getISOWeek(new Date(`${d.fechaInicioPrograma.slice(0, 10)}T00:00:00`))
  const esAprobada = d.estadoInspeccion === 'APROBADA'

  function handleCargarFolios() {
    const folios = Array.from(
      new Set(
        textareaFolios
          .split('\n')
          .map((f) => f.trim())
          .filter((f) => f.length > 0),
      ),
    )
    if (folios.length === 0) {
      toast.error('Ingresa al menos un folio')
      return
    }
    agregarFoliosMutation.mutate(folios)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[85vh] max-w-2xl overflow-auto'>
        <DialogHeader>
          <DialogTitle className='flex flex-wrap items-center gap-2'>
            Instructivo N° {d.numero}
            <Badge className='text-sm font-normal'>Semana {semanaIso}</Badge>
            <Badge variant={d.estadoInspeccion === 'RECHAZADA' ? 'destructive' : 'outline'}>
              {ESTADO_INSPECCION_LABELS[d.estadoInspeccion]}
            </Badge>
          </DialogTitle>
          <DialogDescription>Detalle de la inspección de proceso</DialogDescription>
        </DialogHeader>

        <div className='space-y-4'>
          <div className='space-y-2'>
            <Campo label='Productor'>{d.entidadProductor.descripcion} — {d.entidadProductor.razonSocial}</Campo>
            <Campo label='Grupo de Mercado'>{d.grupoMercado.descripcion}</Campo>
            <Campo label='Inicio de programa'>{formatFechaCorta(d.fechaInicioPrograma)}</Campo>
            {d.observaciones && <Campo label='Observaciones'><span className='whitespace-pre-wrap'>{d.observaciones}</span></Campo>}
            <Campo label='Emitido'>{new Date(d.creadoEn).toLocaleString('es-CL')}</Campo>
            {d.notificadaEn && <Campo label='Notificada'>{new Date(d.notificadaEn).toLocaleString('es-CL')}</Campo>}
          </div>

          <div>
            <h4 className='mb-1 text-sm font-medium'>Detalle — qué embalar</h4>
            <div className='space-y-2'>
              {d.detalle.map((linea) => (
                <div key={linea.id} className='flex flex-wrap items-center gap-2 border-b pb-2 text-sm last:border-b-0 last:pb-0'>
                  <span className='font-medium'>{linea.especie.descripcion} / {linea.variedad.descripcion}</span>
                  {linea.variedadRotulada && <span className='text-muted-foreground'>(rotulada: {linea.variedadRotulada.descripcion})</span>}
                  <span className='text-muted-foreground'>{linea.articulo.descripcion}</span>
                  <span className='text-muted-foreground'>· {linea.categoria.descripcion}</span>
                  <span className='flex flex-wrap items-center gap-1 text-muted-foreground'>
                    · Calibres:
                    {linea.calibres.map((c) => (
                      <Badge key={c.calibre.id} variant='outline' className='text-xs'>{c.calibre.codigo}</Badge>
                    ))}
                  </span>
                  <span className='ml-auto text-muted-foreground'>{linea.cantidadPallets} pallets · {linea.cajas} cajas</span>
                </div>
              ))}
            </div>
          </div>

          {(d.estadoInspeccion === 'APROBADA' || d.estadoInspeccion === 'RECHAZADA' || d.estadoInspeccion === 'CERRADA') && (
            <div className='rounded-md border bg-muted/40 p-3'>
              <h4 className='mb-1 text-sm font-medium'>
                Veredicto — <Badge variant={d.estadoInspeccion === 'RECHAZADA' ? 'destructive' : 'outline'}>{ESTADO_INSPECCION_LABELS[d.estadoInspeccion]}</Badge>
              </h4>
              {d.inspeccionadoEn && (
                <p className='text-xs text-muted-foreground'>
                  {new Date(d.inspeccionadoEn).toLocaleString('es-CL')}{d.inspeccionadoPor ? ` — ${d.inspeccionadoPor}` : ''}
                </p>
              )}
              {d.comentarioInspeccion && <p className='mt-1 whitespace-pre-wrap text-sm'>{d.comentarioInspeccion}</p>}
            </div>
          )}

          <div>
            <h4 className='mb-1 text-sm font-medium'>Folios (números de pallet)</h4>
            {d.folios.length > 0 ? (
              <div className='space-y-1 rounded-md border p-2'>
                {d.folios.map((f) => (
                  <div key={f.id} className='flex items-center gap-2 text-sm'>
                    <span className='flex-1 font-mono'>{f.folio}</span>
                    <Badge variant={f.estado === 'RECEPCIONADO' ? 'outline' : 'secondary'} className='text-xs'>
                      {f.estado === 'RECEPCIONADO' ? 'Recepcionado' : 'Aprobado'}
                    </Badge>
                    {esAprobada && puedeEscribirCalidad && f.estado !== 'RECEPCIONADO' && (
                      <Button
                        variant='ghost'
                        size='icon'
                        className='h-7 w-7'
                        onClick={() => quitarFolioMutation.mutate(f.id)}
                        disabled={quitarFolioMutation.isPending}
                      >
                        <Icons.close className='h-4 w-4' />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className='text-xs text-muted-foreground'>Sin folios cargados.</p>
            )}

            {esAprobada && puedeEscribirCalidad && (
              <div className='mt-2 space-y-1.5'>
                <Label>Cargar folios <span className='text-muted-foreground text-xs'>(uno por línea)</span></Label>
                <Textarea
                  rows={3}
                  value={textareaFolios}
                  onChange={(e) => setTextareaFolios(e.target.value)}
                  placeholder={'PLT-001\nPLT-002\nPLT-003'}
                />
                <Button
                  type='button'
                  variant='secondary'
                  size='sm'
                  onClick={handleCargarFolios}
                  isLoading={agregarFoliosMutation.isPending}
                >
                  <Icons.add className='mr-1 h-4 w-4' /> Cargar folios
                </Button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
