'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Icons } from '@/components/icons'
import { solicitudesService } from '../service'
import { ESTADO_LABELS, FUNCION_LABELS } from '../types'
import type { SolicitudInspeccion } from '../types'

const fmt = new Intl.DateTimeFormat('es-CL', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'America/Santiago',
})

interface SolicitudDetalleDialogProps {
  solicitud: SolicitudInspeccion
  open: boolean
  onOpenChange: (open: boolean) => void
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className='grid grid-cols-[130px_1fr] gap-2 text-sm'>
      <span className='text-muted-foreground'>{label}</span>
      <span>{children}</span>
    </div>
  )
}

export function SolicitudDetalleDialog({ solicitud, open, onOpenChange }: SolicitudDetalleDialogProps) {
  const { direccion } = solicitud
  const tieneGeo = direccion.latitud != null && direccion.longitud != null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[85vh] max-w-2xl overflow-auto'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            {solicitud.codigo}
            <Badge variant='outline'>{ESTADO_LABELS[solicitud.estado]}</Badge>
          </DialogTitle>
          <DialogDescription>Detalle de la solicitud de inspección</DialogDescription>
        </DialogHeader>

        <div className='space-y-4'>
          <div className='space-y-2'>
            <Campo label='Productor'>{solicitud.entidadProductor.razonSocial}</Campo>
            <Campo label='Lugar'>
              {direccion.direccion}{direccion.comuna ? `, ${direccion.comuna.descripcion}` : ''}
              {tieneGeo && (
                <a
                  href={`https://www.google.com/maps?q=${direccion.latitud},${direccion.longitud}`}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='ml-2 inline-flex items-center gap-1 text-primary hover:underline'
                >
                  <Icons.mapPin className='h-3 w-3' /> Mapa
                </a>
              )}
            </Campo>
            {solicitud.contacto && (
              <Campo label='Contacto'>
                {solicitud.contacto.nombre}
                {[solicitud.contacto.telefono, solicitud.contacto.whatsapp, solicitud.contacto.email]
                  .filter(Boolean).length > 0 && (
                  <span className='text-muted-foreground'>
                    {' — '}
                    {[solicitud.contacto.telefono, solicitud.contacto.whatsapp, solicitud.contacto.email]
                      .filter(Boolean).join(' · ')}
                  </span>
                )}
              </Campo>
            )}
            <Campo label='Fecha y hora'>{fmt.format(new Date(solicitud.fechaHora))}</Campo>
            <Campo label='Motivo'>{solicitud.motivo.descripcion}</Campo>
            {solicitud.especie && <Campo label='Especie'>{solicitud.especie.descripcion}</Campo>}
            <Campo label='Temporada'>{solicitud.temporada.codigo}</Campo>
            {solicitud.observaciones && (
              <Campo label='Observaciones'>
                <span className='whitespace-pre-wrap'>{solicitud.observaciones}</span>
              </Campo>
            )}
          </div>

          <div>
            <h4 className='mb-1 text-sm font-medium'>Personas asignadas</h4>
            <div className='space-y-1'>
              {solicitud.asignados.map((a) => (
                <div key={a.id} className='flex items-center gap-2 text-sm'>
                  <Badge variant='outline' className='text-xs'>{FUNCION_LABELS[a.funcion]}</Badge>
                  <span>{a.usuario.nombre}</span>
                  <span className='text-muted-foreground'>{a.usuario.email}</span>
                </div>
              ))}
            </div>
          </div>

          {solicitud.estado === 'CERRADA' && (
            <div className='rounded-md border bg-muted/40 p-3'>
              <h4 className='mb-1 text-sm font-medium'>Cierre</h4>
              {solicitud.fechaCierre && (
                <p className='text-xs text-muted-foreground'>Cerrada el {fmt.format(new Date(solicitud.fechaCierre))}</p>
              )}
              {solicitud.comentariosCierre && (
                <p className='mt-1 whitespace-pre-wrap text-sm'>{solicitud.comentariosCierre}</p>
              )}
            </div>
          )}

          {solicitud.adjuntos.length > 0 && (
            <div>
              <h4 className='mb-1 text-sm font-medium'>Adjuntos</h4>
              <div className='space-y-1'>
                {solicitud.adjuntos.map((adj) => (
                  <a
                    key={adj.id}
                    href={solicitudesService.urlDescargaAdjunto(solicitud.id, adj.id)}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='flex items-center gap-2 text-sm text-primary hover:underline'
                  >
                    <Icons.download className='h-4 w-4' />
                    <span className='flex-1 truncate'>{adj.nombre}</span>
                    <Badge variant='outline' className='text-xs'>{adj.etapa === 'CIERRE' ? 'Cierre' : 'Creación'}</Badge>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
