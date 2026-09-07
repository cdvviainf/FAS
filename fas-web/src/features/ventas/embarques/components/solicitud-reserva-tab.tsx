'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Icons } from '@/components/icons'
import { usePuedeEscribir } from '@/hooks/use-item-acceso'
import { embarquesService } from '../service'
import { embarquesKeys } from '../queries'
import { ESTADO_RESERVA_LABELS } from '../types'
import type { EmbarqueDetalle } from '../types'

const ITEM = 'VENTAS_EMBARQUES'

export function SolicitudReservaTab({ embarque }: { embarque: EmbarqueDetalle }) {
  const puedeEscribir = usePuedeEscribir(ITEM)
  const queryClient = useQueryClient()

  const solicitarMutation = useMutation({
    mutationFn: () => embarquesService.solicitarReserva(embarque.id),
    onSuccess: () => {
      toast.success('Solicitud de Reserva enviada')
      queryClient.invalidateQueries({ queryKey: embarquesKeys.detail(embarque.id) })
      queryClient.invalidateQueries({ queryKey: embarquesKeys.all })
    },
    onError: (e: Error) => toast.error(e.message || 'No se pudo conectar con AGL360 — inténtalo de nuevo más tarde'),
  })

  const solicitud = embarque.solicitudReserva

  return (
    <div className='space-y-4 rounded-md border p-6'>
      <div className='flex items-center gap-2'>
        <Badge variant={embarque.estadoReserva === 'CONFIRMADA' ? 'default' : embarque.estadoReserva === 'SOLICITADA' ? 'secondary' : 'destructive'}>
          {ESTADO_RESERVA_LABELS[embarque.estadoReserva]}
        </Badge>
      </div>

      {embarque.estadoReserva === 'PENDIENTE' && (
        <div className='space-y-3 text-center'>
          <p className='text-sm text-muted-foreground'>
            Este Embarque no tiene una Solicitud de Reserva enviada — la última integración con AGL360 falló o nunca
            se intentó.
          </p>
          {puedeEscribir && (
            <Button
              type='button'
              onClick={() => solicitarMutation.mutate()}
              isLoading={solicitarMutation.isPending}
            >
              <Icons.check className='mr-1 h-4 w-4' /> Solicitar Reserva
            </Button>
          )}
        </div>
      )}

      {embarque.estadoReserva === 'SOLICITADA' && (
        <p className='text-sm text-muted-foreground'>
          Solicitud enviada el {solicitud ? new Date(solicitud.enviadoEn).toLocaleString('es-CL') : '—'} — esperando
          confirmación de AGL360.
        </p>
      )}

      {embarque.estadoReserva === 'CONFIRMADA' && solicitud && (
        <div className='grid grid-cols-2 gap-3 text-sm'>
          {solicitud.numeroBooking && <div><span className='text-muted-foreground'>N° Booking:</span> {solicitud.numeroBooking}</div>}
          {solicitud.naviera && <div><span className='text-muted-foreground'>Naviera:</span> {solicitud.naviera}</div>}
          {solicitud.nave && <div><span className='text-muted-foreground'>Nave:</span> {solicitud.nave}</div>}
          {solicitud.numeroContenedor && <div><span className='text-muted-foreground'>Contenedor:</span> {solicitud.numeroContenedor}</div>}
          {solicitud.fechaZarpe && <div><span className='text-muted-foreground'>Fecha zarpe:</span> {new Date(solicitud.fechaZarpe).toLocaleDateString('es-CL')}</div>}
          {solicitud.fechaRetiroPlanta && <div><span className='text-muted-foreground'>Retiro planta:</span> {new Date(solicitud.fechaRetiroPlanta).toLocaleDateString('es-CL')}</div>}
        </div>
      )}
    </div>
  )
}
