'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Icons } from '@/components/icons'
import { solicitudesService } from '../service'
import { ESTADO_LABELS, FUNCION_LABELS, TIPO_INSPECCION_LABELS, RESULTADO_CIERRE_LABELS } from '../types'
import type { SolicitudInspeccion, EstadoLineaInspeccion } from '../types'

const fmt = new Intl.DateTimeFormat('es-CL', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'America/Santiago',
})

// Badge del veredicto por línea del cierre (verde/amarillo/rojo).
const CLASES_ESTADO_LINEA: Record<EstadoLineaInspeccion, string> = {
  APROBADA: 'border-green-300 bg-green-100 text-green-800',
  OBJETADA: 'border-amber-300 bg-amber-100 text-amber-800',
  RECHAZADA: 'border-red-300 bg-red-100 text-red-800',
}

function BadgeEstadoLinea({ estado }: { estado: EstadoLineaInspeccion | null }) {
  if (!estado) return <Badge variant='outline' className='text-muted-foreground text-xs'>Pendiente</Badge>
  return <Badge variant='outline' className={`text-xs ${CLASES_ESTADO_LINEA[estado]}`}>{RESULTADO_CIERRE_LABELS[estado]}</Badge>
}

interface SolicitudDetalleDialogProps {
  solicitud: SolicitudInspeccion
  open: boolean
  onOpenChange: (open: boolean) => void
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className='grid grid-cols-[110px_1fr] gap-2 text-sm sm:grid-cols-[130px_1fr]'>
      <span className='text-muted-foreground'>{label}</span>
      <span className='min-w-0 break-words'>{children}</span>
    </div>
  )
}

export function SolicitudDetalleDialog({ solicitud, open, onOpenChange }: SolicitudDetalleDialogProps) {
  const { direccion } = solicitud
  const tieneGeo = direccion.latitud != null && direccion.longitud != null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[90vh] sm:max-w-[900px] overflow-auto'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            {solicitud.codigo}
            <Badge variant='outline'>{ESTADO_LABELS[solicitud.estado]}</Badge>
          </DialogTitle>
          <DialogDescription>Detalle de la solicitud de inspección</DialogDescription>
        </DialogHeader>

        <div className='space-y-4'>
          <div className='space-y-2'>
            <Campo label='Solicitante'>{solicitud.usuarioSolicitante.nombre}</Campo>
            <Campo label='Productor'>{solicitud.entidadProductor.razonSocial}</Campo>
            <Campo label='Lugar'>
              {direccion.descripcion} — {direccion.direccion}{direccion.comuna ? `, ${direccion.comuna.descripcion}` : ''}
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
            <Campo label='Fecha de ingreso'>{fmt.format(new Date(solicitud.creadoEn))}</Campo>
            <Campo label='Fecha y hora de visita'>{solicitud.fechaHora ? fmt.format(new Date(solicitud.fechaHora)) : 'Por definir'}</Campo>
            {solicitud.tipoInspeccion && <Campo label='Tipo de inspección'>{TIPO_INSPECCION_LABELS[solicitud.tipoInspeccion]}</Campo>}
            {solicitud.mercado && <Campo label='Mercado'>{solicitud.mercado.descripcion}</Campo>}
            {solicitud.paises.length > 0 && (
              <Campo label='Países'>{solicitud.paises.map((p) => p.pais.descripcion).join(', ')}</Campo>
            )}
            {solicitud.cliente && <Campo label='Cliente'>{solicitud.cliente.razonSocial}</Campo>}
            {solicitud.fechaDespacho && (
              <Campo label='Fecha despacho'>{new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium' }).format(new Date(solicitud.fechaDespacho))}</Campo>
            )}
            <Campo label='Temporada'>{solicitud.temporada.codigo}</Campo>
            {solicitud.observaciones && (
              <Campo label='Observaciones'>
                <span className='whitespace-pre-wrap'>{solicitud.observaciones}</span>
              </Campo>
            )}
          </div>

          {solicitud.lineas.length > 0 && (
            <div className='space-y-1'>
              <h4 className='text-sm font-medium'>Producto a inspeccionar</h4>
              <div className='overflow-x-auto rounded-md border'>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Especie</TableHead>
                      <TableHead>Variedad</TableHead>
                      <TableHead>Embalaje</TableHead>
                      <TableHead>Categorías</TableHead>
                      <TableHead>Calibres</TableHead>
                      <TableHead>Calidades</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className='text-right'>Pallets</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {solicitud.lineas.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className='whitespace-nowrap font-medium'>{l.especie.descripcion}</TableCell>
                        <TableCell className='whitespace-nowrap'>{l.variedad.descripcion}</TableCell>
                        <TableCell className='whitespace-nowrap'>{l.articulo.descripcion}</TableCell>
                        <TableCell>{l.categorias.map((c) => c.categoria.descripcion).join(', ') || '—'}</TableCell>
                        <TableCell>{l.calibres.map((c) => c.calibre.descripcion).join(', ') || '—'}</TableCell>
                        <TableCell>{l.calidades.map((c) => `${c.notaCalidad.descripcion}/${c.notaCondicion.descripcion}`).join(', ') || '—'}</TableCell>
                        <TableCell><BadgeEstadoLinea estado={l.estadoCierre} /></TableCell>
                        <TableCell className='text-right tabular-nums'>{l.cantidadPallets ?? '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

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

          {['APROBADA', 'RECHAZADA', 'OBJETADA', 'MIXTO'].includes(solicitud.estado) && (
            <div className='rounded-md border bg-muted/40 p-3'>
              <h4 className='mb-1 text-sm font-medium'>
                Cierre — <Badge variant={solicitud.estado === 'APROBADA' ? 'outline' : solicitud.estado === 'MIXTO' ? 'default' : 'destructive'}>{ESTADO_LABELS[solicitud.estado]}</Badge>
              </h4>
              {solicitud.fechaCierre && (
                <p className='text-xs text-muted-foreground'>Cerrada el {fmt.format(new Date(solicitud.fechaCierre))}</p>
              )}
              {solicitud.comentariosCierre && (
                <p className='mt-1 whitespace-pre-wrap text-sm'>{solicitud.comentariosCierre}</p>
              )}

              {/* Resultado POR LÍNEA: veredicto + defectos + madurez de cada línea. */}
              <div className='mt-2 space-y-2'>
                {solicitud.lineas.map((l) => {
                  const defs = solicitud.defectos.filter((d) => d.solicitudLineaId === l.id)
                  const mads = (solicitud.madurez ?? []).filter((m) => m.solicitudLineaId === l.id)
                  return (
                    <div key={l.id} className='rounded border bg-background p-2'>
                      <div className='flex flex-wrap items-center gap-2 text-sm font-medium'>
                        {l.especie.descripcion} · {l.variedad.descripcion}
                        <BadgeEstadoLinea estado={l.estadoCierre} />
                      </div>
                      {defs.length > 0 && (
                        <ul className='mt-1 space-y-0.5 text-sm'>
                          {defs.map((d) => (
                            <li key={d.id}>
                              {d.grupoDefecto.descripcion} · {d.defecto.descripcion}:{' '}
                              {String(d.valor).replace('.', ',')}{d.defecto.tipoMedida === 'PORCENTAJE' ? '%' : ' u.'}
                            </li>
                          ))}
                        </ul>
                      )}
                      {mads.length > 0 && (
                        <ul className='mt-1 space-y-0.5 text-sm'>
                          {mads.map((m) => {
                            const sufijo = m.valorTexto != null ? '' : m.caracteristica.tipoDato === 'PORCENTAJE' ? '%' : m.caracteristica.unidad ? ` ${m.caracteristica.unidad.codigo}` : ''
                            const valor = m.valorTexto != null ? m.valorTexto : String(m.valorNumerico ?? '').replace('.', ',')
                            return <li key={m.id}>{m.caracteristica.descripcion}: {valor}{sufijo}</li>
                          })}
                        </ul>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Histórico: defectos/madurez sin línea (cierres previos a nivel solicitud). */}
              {(() => {
                const defsHist = solicitud.defectos.filter((d) => d.solicitudLineaId == null)
                const madsHist = (solicitud.madurez ?? []).filter((m) => m.solicitudLineaId == null)
                if (defsHist.length === 0 && madsHist.length === 0) return null
                return (
                  <div className='mt-2 rounded border border-dashed bg-background p-2'>
                    <p className='text-muted-foreground text-xs font-medium'>General (cierre histórico sin línea)</p>
                    <ul className='mt-1 space-y-0.5 text-sm'>
                      {defsHist.map((d) => (
                        <li key={`d${d.id}`}>{d.grupoDefecto.descripcion} · {d.defecto.descripcion}: {String(d.valor).replace('.', ',')}{d.defecto.tipoMedida === 'PORCENTAJE' ? '%' : ' u.'}</li>
                      ))}
                      {madsHist.map((m) => {
                        const sufijo = m.valorTexto != null ? '' : m.caracteristica.tipoDato === 'PORCENTAJE' ? '%' : m.caracteristica.unidad ? ` ${m.caracteristica.unidad.codigo}` : ''
                        const valor = m.valorTexto != null ? m.valorTexto : String(m.valorNumerico ?? '').replace('.', ',')
                        return <li key={`m${m.id}`}>{m.caracteristica.descripcion}: {valor}{sufijo}</li>
                      })}
                    </ul>
                  </div>
                )
              })()}
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
