'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Icons } from '@/components/icons'
import { formatFechaCorta, formatMonto } from '@/lib/format'
import { usePuedeEscribir } from '@/hooks/use-item-acceso'
import { solicitudesPagoKeys, solicitudesPagoService } from '../service'
import { ESTADO_SOLICITUD_PAGO_LABELS, ITEM_SOLICITUD_PAGO } from '../types'
import type { EstadoSolicitudPago } from '../types'

export const ESTADO_VARIANT: Record<EstadoSolicitudPago, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  SOLICITADA: 'secondary',
  PAGADA: 'default',
  ANULADA: 'destructive',
}

export function SolicitudPagoListingClient() {
  const router = useRouter()
  const puedeEscribir = usePuedeEscribir(ITEM_SOLICITUD_PAGO)
  const [q, setQ] = useState('')
  const [estado, setEstado] = useState<EstadoSolicitudPago | 'TODOS'>('TODOS')
  const [page, setPage] = useState(1)
  const limit = 20
  const params = { page, limit, ...(q.trim() ? { q: q.trim() } : {}), ...(estado !== 'TODOS' ? { estado } : {}) }

  const { data, isPending } = useQuery({
    queryKey: solicitudesPagoKeys.list(params),
    queryFn: () => solicitudesPagoService.list(params),
    placeholderData: keepPreviousData,
  })
  const filas = data?.data ?? []
  const totalPages = data?.meta.totalPages ?? 1

  return (
    <div className='space-y-4'>
      <div className='flex flex-wrap items-end justify-between gap-3'>
        <div className='flex flex-wrap items-end gap-3'>
          <div className='grid gap-1'>
            <label className='text-muted-foreground text-xs'>Buscar</label>
            <Input
              placeholder='N° solicitud o productor…'
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1) }}
              className='w-64'
            />
          </div>
          <div className='grid gap-1'>
            <label className='text-muted-foreground text-xs'>Estado</label>
            <Select value={estado} onValueChange={(v) => { setEstado(v as EstadoSolicitudPago | 'TODOS'); setPage(1) }}>
              <SelectTrigger className='w-44'><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value='TODOS'>Todos</SelectItem>
                {(Object.keys(ESTADO_SOLICITUD_PAGO_LABELS) as EstadoSolicitudPago[]).map((e) => (
                  <SelectItem key={e} value={e}>{ESTADO_SOLICITUD_PAGO_LABELS[e]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {puedeEscribir && (
          <Button onClick={() => router.push('/dashboard/productores/pagos/nueva')}>
            <Icons.add className='mr-1 h-4 w-4' /> Nueva Solicitud
          </Button>
        )}
      </div>

      {isPending ? (
        <p className='text-muted-foreground text-sm'>Cargando...</p>
      ) : filas.length === 0 ? (
        <p className='text-muted-foreground rounded-md border border-dashed p-8 text-center text-sm'>
          No hay solicitudes de pago registradas.
        </p>
      ) : (
        <>
          <div className='overflow-x-auto rounded-md border'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N° Solicitud</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Productor</TableHead>
                  <TableHead className='text-right'>Cuotas</TableHead>
                  <TableHead className='text-right'>Monto</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className='text-right'>Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filas.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className='font-mono text-sm'>{s.numero}</TableCell>
                    <TableCell className='text-muted-foreground'>{formatFechaCorta(s.fecha)}</TableCell>
                    <TableCell>{s.entidadProductor.razonSocial}</TableCell>
                    <TableCell className='text-right tabular-nums'>{s._count?.lineas ?? '—'}</TableCell>
                    <TableCell className='text-right tabular-nums'>{s.moneda.codigo} {formatMonto(s.montoTotal)}</TableCell>
                    <TableCell><Badge variant={ESTADO_VARIANT[s.estado]}>{ESTADO_SOLICITUD_PAGO_LABELS[s.estado]}</Badge></TableCell>
                    <TableCell className='text-right'>
                      <Button variant='outline' size='sm' onClick={() => router.push(`/dashboard/productores/pagos/${s.id}`)}>
                        {puedeEscribir && s.estado === 'SOLICITADA' ? 'Editar' : 'Ver'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className='flex items-center justify-between text-sm'>
            <p className='text-muted-foreground'>Página {page} de {totalPages} · {data?.meta.total ?? 0} solicitud(es)</p>
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
