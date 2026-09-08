'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Combobox } from '@/components/ui/combobox'
import { Icons } from '@/components/icons'
import { entidadesService } from '@/features/entidades/service'
import { reclamosListOptions } from '../queries'
import { ESTADO_RECLAMO_LABELS } from '../types'
import type { EstadoReclamo } from '../types'

// IMP-QA-R1-022: filtros por folio de Embarque y cliente (antes solo
// estado), más paginación real (antes solo mostraba los primeros 20).
export function ReclamosListingClient() {
  const router = useRouter()
  const [estado, setEstado] = useState<EstadoReclamo | 'TODOS'>('TODOS')
  const [folio, setFolio] = useState('')
  const [clienteId, setClienteId] = useState<number | null>(null)
  const [page, setPage] = useState(1)
  const limit = 20

  const { data: clientesData } = useQuery({
    queryKey: ['entidades-cliente-options'],
    queryFn: () => entidadesService.list({ activo: true, limit: 200 }),
    staleTime: 60_000,
  })
  const clientes = clientesData?.data ?? []

  const { data, isPending } = useQuery(
    reclamosListOptions({
      ...(estado !== 'TODOS' ? { estado } : {}),
      ...(folio.trim() ? { folio: folio.trim() } : {}),
      ...(clienteId ? { clienteId } : {}),
      page,
      limit,
    }),
  )
  const reclamos = data?.data ?? []
  const totalPages = data?.meta.totalPages ?? 1

  function limpiarFiltros() {
    setEstado('TODOS')
    setFolio('')
    setClienteId(null)
    setPage(1)
  }

  return (
    <div className='space-y-3'>
      <div className='flex flex-wrap items-end gap-3'>
        <div className='min-w-[160px] space-y-1.5'>
          <Label className='text-[10.5px] tracking-wide uppercase'>Folio Embarque</Label>
          <Input
            value={folio}
            onChange={(e) => { setFolio(e.target.value); setPage(1) }}
            placeholder='Ej. MAR0042'
            className='h-9'
          />
        </div>
        <div className='min-w-[200px] space-y-1.5'>
          <Label className='text-[10.5px] tracking-wide uppercase'>Cliente</Label>
          <Combobox
            options={[{ value: 'todos', label: 'Todos' }, ...clientes.map((c) => ({ value: String(c.id), label: c.descripcion }))]}
            value={clienteId ? String(clienteId) : 'todos'}
            onChange={(v) => { setClienteId(v === 'todos' ? null : Number(v)); setPage(1) }}
            placeholder='Todos'
            searchPlaceholder='Buscar cliente...'
          />
        </div>
        <div className='min-w-[180px] space-y-1.5'>
          <Label className='text-[10.5px] tracking-wide uppercase'>Estado</Label>
          <Select value={estado} onValueChange={(v) => { setEstado(v as EstadoReclamo | 'TODOS'); setPage(1) }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value='TODOS'>Todos los estados</SelectItem>
              {(Object.keys(ESTADO_RECLAMO_LABELS) as EstadoReclamo[]).map((e) => (
                <SelectItem key={e} value={e}>{ESTADO_RECLAMO_LABELS[e]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type='button' variant='ghost' size='sm' onClick={limpiarFiltros}>
          <Icons.close className='mr-2 h-4 w-4' /> Limpiar filtros
        </Button>
      </div>

      {isPending ? (
        <p className='text-muted-foreground text-sm'>Cargando...</p>
      ) : reclamos.length === 0 ? (
        <p className='text-muted-foreground rounded-md border border-dashed p-8 text-center text-sm'>Sin reclamos.</p>
      ) : (
        <>
          <div className='overflow-x-auto rounded-md border'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Embarque</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Resumen</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Análisis Calidad</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reclamos.map((r) => (
                  <TableRow key={r.id} className='cursor-pointer' onClick={() => router.push(`/dashboard/calidad/reclamos/${r.id}`)}>
                    <TableCell className='font-medium'>{r.embarque.numeroInstructivo}</TableCell>
                    <TableCell>{r.cliente.descripcion}</TableCell>
                    <TableCell className='text-muted-foreground'>{r.fechaReclamo ?? '—'}</TableCell>
                    <TableCell className='max-w-xs truncate'>{r.resumenCliente ?? '—'}</TableCell>
                    <TableCell><Badge variant='outline'>{ESTADO_RECLAMO_LABELS[r.estado]}</Badge></TableCell>
                    <TableCell>
                      {r.comentarioCalidad ? (
                        <Badge variant='default'>Completado</Badge>
                      ) : (
                        <Badge variant='secondary'>Pendiente</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className='flex items-center justify-between text-sm'>
            <p className='text-muted-foreground'>Página {page} de {totalPages} · {data?.meta.total ?? 0} reclamo(s)</p>
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
