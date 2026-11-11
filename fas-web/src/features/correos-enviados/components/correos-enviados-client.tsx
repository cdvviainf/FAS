'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Icons } from '@/components/icons'
import { usePuedeEscribir } from '@/hooks/use-item-acceso'
import { correosEnviadosService, ESTADO_CORREO_LABELS } from '../service'
import type { CorreoEnviado, EstadoCorreo } from '../service'

const ITEM = 'CONFIG_CORREOS_ENVIADOS'

const ESTADO_VARIANT: Record<EstadoCorreo, 'default' | 'secondary' | 'destructive'> = {
  PENDIENTE: 'secondary',
  ENVIADO: 'default',
  FALLIDO: 'destructive',
}

const fmtFechaHora = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' }) : '—'

// Inicio del día local (YYYY-MM-DD + offset de días) como ISO con zona —
// respeta el cambio de horario (CE-QA-002).
function inicioDiaLocalIso(fecha: string, sumarDias: number): string {
  const [y, m, d] = fecha.split('-').map(Number)
  return new Date(y, m - 1, d + sumarDias, 0, 0, 0, 0).toISOString()
}

// Visor de correos enviados (2026-11-11): una fila por destinatario; reintento
// por fila (mismo contenido, el PDF adjunto se regenera).
export function CorreosEnviadosClient() {
  const queryClient = useQueryClient()
  const puedeReintentar = usePuedeEscribir(ITEM)
  const [q, setQ] = useState('')
  const [estado, setEstado] = useState<EstadoCorreo | 'TODOS'>('TODOS')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [page, setPage] = useState(1)
  const [detalleId, setDetalleId] = useState<number | null>(null)
  const filtros = {
    page,
    limit: 50,
    q: q.trim() || undefined,
    estado: estado === 'TODOS' ? undefined : estado,
    desde: desde ? inicioDiaLocalIso(desde, 0) : undefined,
    // "hasta" inclusive: inicio del día siguiente (exclusivo), en hora local.
    hasta: hasta ? inicioDiaLocalIso(hasta, 1) : undefined,
  }

  const { data, isPending } = useQuery({
    queryKey: ['correos-enviados', filtros],
    queryFn: () => correosEnviadosService.list(filtros),
    placeholderData: keepPreviousData,
    // Los envíos se procesan en segundo plano: refresca mientras haya pendientes.
    refetchInterval: (query) => (query.state.data?.data.some((c) => c.estado === 'PENDIENTE') ? 5000 : false),
  })
  const { data: detalle } = useQuery({
    queryKey: ['correos-enviados', 'detalle', detalleId],
    queryFn: () => correosEnviadosService.getById(detalleId!),
    enabled: detalleId != null,
  })

  const reintentar = useMutation({
    mutationFn: (id: number) => correosEnviadosService.reintentar(id),
    onSuccess: () => {
      toast.success('Correo reencolado para envío')
      queryClient.invalidateQueries({ queryKey: ['correos-enviados'] })
    },
    onError: (e: Error) => toast.error(e.message || 'No se pudo reintentar el envío'),
  })

  const filas = data?.data ?? []
  const totalPages = data?.meta.totalPages ?? 1

  return (
    <div className='space-y-4'>
      <div className='flex flex-wrap items-end gap-3'>
        <div className='grid gap-1'>
          <label className='text-muted-foreground text-xs'>Buscar</label>
          <Input className='w-72' placeholder='Destinatario, asunto u origen…' value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} />
        </div>
        <div className='grid gap-1'>
          <label className='text-muted-foreground text-xs'>Estado</label>
          <Select value={estado} onValueChange={(v) => { setEstado(v as EstadoCorreo | 'TODOS'); setPage(1) }}>
            <SelectTrigger className='w-40'><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value='TODOS'>Todos</SelectItem>
              {(Object.keys(ESTADO_CORREO_LABELS) as EstadoCorreo[]).map((e) => (
                <SelectItem key={e} value={e}>{ESTADO_CORREO_LABELS[e]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className='grid gap-1'>
          <label className='text-muted-foreground text-xs'>Desde</label>
          <Input type='date' className='w-40' value={desde} onChange={(e) => { setDesde(e.target.value); setPage(1) }} />
        </div>
        <div className='grid gap-1'>
          <label className='text-muted-foreground text-xs'>Hasta</label>
          <Input type='date' className='w-40' value={hasta} onChange={(e) => { setHasta(e.target.value); setPage(1) }} />
        </div>
      </div>

      {isPending ? (
        <p className='text-muted-foreground text-sm'>Cargando...</p>
      ) : filas.length === 0 ? (
        <p className='text-muted-foreground rounded-md border border-dashed p-8 text-center text-sm'>No hay correos registrados con estos filtros.</p>
      ) : (
        <>
          <div className='overflow-x-auto rounded-md border'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Destinatario</TableHead>
                  <TableHead>Asunto</TableHead>
                  <TableHead>Origen</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Enviado</TableHead>
                  <TableHead className='text-right'>Intentos</TableHead>
                  <TableHead className='text-right'>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filas.map((c: CorreoEnviado) => (
                  <TableRow key={c.id}>
                    <TableCell className='whitespace-nowrap text-sm'>{fmtFechaHora(c.creadoEn)}</TableCell>
                    <TableCell className='text-sm'>{c.destinatario}</TableCell>
                    <TableCell className='max-w-xs truncate text-sm' title={c.asunto}>{c.asunto}</TableCell>
                    <TableCell className='text-muted-foreground max-w-xs truncate text-xs' title={c.origen ?? ''}>{c.origen ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant={ESTADO_VARIANT[c.estado]} title={c.ultimoError ?? undefined}>{ESTADO_CORREO_LABELS[c.estado]}</Badge>
                      {c.estado === 'FALLIDO' && c.ultimoError && <p className='mt-1 max-w-xs truncate text-xs text-destructive' title={c.ultimoError}>{c.ultimoError}</p>}
                    </TableCell>
                    <TableCell className='whitespace-nowrap text-sm'>{fmtFechaHora(c.enviadoEn)}</TableCell>
                    <TableCell className='text-right tabular-nums'>{c.intentos}</TableCell>
                    <TableCell className='text-right'>
                      <div className='flex justify-end gap-1'>
                        <Button variant='ghost' size='sm' onClick={() => setDetalleId(c.id)}>
                          <Icons.search className='h-4 w-4' />
                        </Button>
                        {puedeReintentar && c.estado !== 'PENDIENTE' && (
                          <Button variant='outline' size='sm' onClick={() => reintentar.mutate(c.id)} disabled={reintentar.isPending}>
                            Reintentar
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className='flex items-center justify-between text-sm'>
            <p className='text-muted-foreground'>Página {page} de {totalPages} · {data?.meta.total ?? 0} registro(s)</p>
            <div className='flex gap-2'>
              <Button variant='outline' size='sm' disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
              <Button variant='outline' size='sm' disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Siguiente</Button>
            </div>
          </div>
        </>
      )}

      <Dialog open={detalleId != null} onOpenChange={(v) => !v && setDetalleId(null)}>
        <DialogContent className='max-h-[90vh] overflow-auto sm:max-w-[820px]'>
          <DialogHeader>
            <DialogTitle>{detalle?.data.asunto ?? 'Correo'}</DialogTitle>
          </DialogHeader>
          {detalle?.data && (
            <div className='space-y-3 text-sm'>
              <p>
                <span className='text-muted-foreground'>Para:</span> {detalle.data.destinatario} ·{' '}
                <Badge variant={ESTADO_VARIANT[detalle.data.estado]}>{ESTADO_CORREO_LABELS[detalle.data.estado]}</Badge>
                {detalle.data.pdfTipo && <span className='text-muted-foreground'> · con PDF adjunto</span>}
              </p>
              <p className='text-muted-foreground'>
                Creado {fmtFechaHora(detalle.data.creadoEn)} · Enviado {fmtFechaHora(detalle.data.enviadoEn)} · Intentos {detalle.data.intentos}
                {detalle.data.reintentadoEn ? ` · Reintentado ${fmtFechaHora(detalle.data.reintentadoEn)}` : ''}
              </p>
              {detalle.data.ultimoError && <p className='text-destructive whitespace-pre-wrap'>{detalle.data.ultimoError}</p>}
              {/* Contenido tal como se envió (aislado en un iframe sin scripts). */}
              <iframe title='Contenido del correo' sandbox='' srcDoc={detalle.data.html ?? ''} className='h-[50vh] w-full rounded-md border bg-white' />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
