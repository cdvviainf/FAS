'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Icons } from '@/components/icons'
import { formatFechaCorta, formatMonto } from '@/lib/format'
import { monitorDteKeys, monitorDteService } from '../service'
import { ESTADO_SII_LABELS, TIPOS_DTE, type EstadoSiiDte, type MonitorDteFila } from '../types'

const ESTADO_VARIANT: Record<EstadoSiiDte, 'default' | 'secondary' | 'destructive'> = {
  PENDIENTE: 'secondary',
  ACEPTADO: 'default',
  RECHAZADO: 'destructive',
}

const TODOS = '__all__'

// Monitor DTE (2026-11-07): documentos electrónicos firmados (todos los orígenes)
// con su veredicto del SII; descarga de XML y PDF timbrado; consulta del estado.
export function MonitorDteClient() {
  const queryClient = useQueryClient()
  const [tipoDte, setTipoDte] = useState(TODOS)
  const [estadoSii, setEstadoSii] = useState(TODOS)
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [folio, setFolio] = useState('')
  const [receptor, setReceptor] = useState('')
  const [page, setPage] = useState(1)
  const limit = 20

  const filtros = {
    page,
    limit,
    ...(tipoDte !== TODOS ? { tipoDte: Number(tipoDte) } : {}),
    ...(estadoSii !== TODOS ? { estadoSii: estadoSii as EstadoSiiDte } : {}),
    ...(fechaDesde ? { fechaDesde } : {}),
    ...(fechaHasta ? { fechaHasta } : {}),
    ...(Number(folio) > 0 ? { folio: Number(folio) } : {}),
    ...(receptor.trim() ? { receptor: receptor.trim() } : {}),
  }
  const { data, isPending, isError } = useQuery({
    queryKey: monitorDteKeys.list(filtros),
    queryFn: () => monitorDteService.list(filtros),
    placeholderData: keepPreviousData,
  })
  const filas = data?.data ?? []
  const totalPages = data?.meta.totalPages ?? 1

  const [consultandoId, setConsultandoId] = useState<number | null>(null)
  const consultar = useMutation({
    mutationFn: (id: number) => monitorDteService.consultarSii(id),
    onMutate: (id) => setConsultandoId(id),
    onSuccess: ({ data: r }) => {
      const v = r.sii.veredicto
      if (v === 'ACEPTADO') toast.success('El SII aceptó el documento')
      else if (v === 'RECHAZADO') toast.error(`El SII rechazó el documento: ${r.sii.glosa}`)
      else toast.info('El SII aún no entrega un veredicto definitivo')
      queryClient.invalidateQueries({ queryKey: monitorDteKeys.all })
    },
    onError: (e: Error) => toast.error(e.message || 'No se pudo consultar el estado en el SII'),
    onSettled: () => setConsultandoId(null),
  })

  async function verPdf(f: MonitorDteFila) {
    try {
      await monitorDteService.verPdf(f.id)
    } catch (e) {
      toast.error((e as Error).message || 'No se pudo obtener el PDF timbrado')
    }
  }
  async function descargarXml(f: MonitorDteFila) {
    try {
      await monitorDteService.descargarXml(f.id, `DTE${f.tipoDte}_F${f.folio}.xml`)
    } catch (e) {
      toast.error((e as Error).message || 'No se pudo descargar el XML')
    }
  }

  const reset = <T,>(set: (v: T) => void) => (v: T) => {
    set(v)
    setPage(1)
  }

  return (
    <div className='space-y-4'>
      <div className='flex flex-wrap items-end gap-3'>
        <div className='grid gap-1'>
          <label className='text-muted-foreground text-xs'>Tipo de DTE</label>
          <Select value={tipoDte} onValueChange={reset(setTipoDte)}>
            <SelectTrigger className='w-64'><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todos</SelectItem>
              {TIPOS_DTE.map((t) => (
                <SelectItem key={t.codigo} value={String(t.codigo)}>{t.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className='grid gap-1'>
          <label className='text-muted-foreground text-xs'>Estado SII</label>
          <Select value={estadoSii} onValueChange={reset(setEstadoSii)}>
            <SelectTrigger className='w-40'><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todos</SelectItem>
              {(Object.keys(ESTADO_SII_LABELS) as EstadoSiiDte[]).map((e) => (
                <SelectItem key={e} value={e}>{ESTADO_SII_LABELS[e]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className='grid gap-1'>
          <label className='text-muted-foreground text-xs'>Desde</label>
          <Input type='date' className='w-40' max={fechaHasta || undefined} value={fechaDesde} onChange={(e) => reset(setFechaDesde)(e.target.value)} />
        </div>
        <div className='grid gap-1'>
          <label className='text-muted-foreground text-xs'>Hasta</label>
          <Input type='date' className='w-40' min={fechaDesde || undefined} value={fechaHasta} onChange={(e) => reset(setFechaHasta)(e.target.value)} />
        </div>
        <div className='grid gap-1'>
          <label className='text-muted-foreground text-xs'>Folio</label>
          <Input inputMode='numeric' className='w-28' value={folio} onChange={(e) => reset(setFolio)(e.target.value.replace(/\D/g, ''))} />
        </div>
        <div className='grid gap-1'>
          <label className='text-muted-foreground text-xs'>Receptor</label>
          <Input placeholder='RUT o razón social…' className='w-56' value={receptor} onChange={(e) => reset(setReceptor)(e.target.value)} />
        </div>
      </div>

      {isPending ? (
        <p className='text-muted-foreground text-sm'>Cargando...</p>
      ) : isError ? (
        <p className='text-destructive text-sm'>No se pudo cargar el monitor de documentos.</p>
      ) : filas.length === 0 ? (
        <p className='text-muted-foreground rounded-md border border-dashed p-8 text-center text-sm'>
          No hay documentos firmados con esos filtros.
        </p>
      ) : (
        <>
          <div className='overflow-x-auto rounded-md border'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead className='text-right'>Folio</TableHead>
                  <TableHead>Emisión</TableHead>
                  <TableHead>Receptor</TableHead>
                  <TableHead className='text-right'>Total</TableHead>
                  <TableHead>Origen</TableHead>
                  <TableHead>Estado SII</TableHead>
                  <TableHead className='text-right'>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filas.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className='text-sm'>
                      {f.tipoNombre} <span className='text-muted-foreground'>({f.tipoDte})</span>
                    </TableCell>
                    <TableCell className='text-right font-mono'>{f.folio}</TableCell>
                    <TableCell className='text-muted-foreground'>{f.fechaEmision ? formatFechaCorta(f.fechaEmision) : '—'}</TableCell>
                    <TableCell>
                      <p className='font-medium'>{f.razonSocialReceptor ?? '—'}</p>
                      <p className='text-muted-foreground text-xs'>{f.rutReceptor}</p>
                    </TableCell>
                    <TableCell className='text-right tabular-nums'>
                      {f.montoTotal != null ? (
                        <>
                          {f.moneda && <span className='text-muted-foreground mr-1 text-xs'>{f.moneda}</span>}
                          {formatMonto(f.montoTotal)}
                        </>
                      ) : '—'}
                    </TableCell>
                    <TableCell className='text-sm'>
                      <p className='text-muted-foreground text-xs'>{f.origen.etiqueta}</p>
                      {f.origen.ruta ? (
                        <Link href={f.origen.ruta} className='text-primary underline-offset-2 hover:underline'>
                          {f.origen.codigo ?? `#${f.origen.id}`}
                        </Link>
                      ) : (
                        <span>{f.origen.codigo ?? `#${f.origen.id}`}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={ESTADO_VARIANT[f.estadoSii]} title={f.estadoSiiGlosa ?? undefined}>
                        {ESTADO_SII_LABELS[f.estadoSii]}
                      </Badge>
                      {f.estadoSiiConsultadoEn && (
                        <p className='text-muted-foreground mt-0.5 text-[11px]'>Consultado {formatFechaCorta(f.estadoSiiConsultadoEn)}</p>
                      )}
                      {f.estadoSii === 'RECHAZADO' && f.estadoSiiGlosa && (
                        <p className='text-destructive mt-0.5 max-w-56 truncate text-[11px]' title={f.estadoSiiGlosa}>{f.estadoSiiGlosa}</p>
                      )}
                    </TableCell>
                    <TableCell className='text-right'>
                      <div className='flex justify-end gap-1'>
                        <Button variant='outline' size='sm' title='Ver PDF timbrado' onClick={() => verPdf(f)}>
                          <Icons.page className='mr-1 h-4 w-4' /> PDF
                        </Button>
                        <Button variant='outline' size='sm' title='Descargar XML' onClick={() => descargarXml(f)}>
                          <Icons.download className='mr-1 h-4 w-4' /> XML
                        </Button>
                        <Button
                          variant='outline'
                          size='sm'
                          title='Consultar estado SII'
                          isLoading={consultar.isPending && consultandoId === f.id}
                          disabled={consultar.isPending}
                          onClick={() => consultar.mutate(f.id)}
                        >
                          <Icons.search className='mr-1 h-4 w-4' /> SII
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className='flex items-center justify-between text-sm'>
            <p className='text-muted-foreground'>Página {page} de {totalPages} · {data?.meta.total ?? 0} documento(s)</p>
            <div className='flex gap-2'>
              <Button variant='outline' size='sm' disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
              <Button variant='outline' size='sm' disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Siguiente</Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
