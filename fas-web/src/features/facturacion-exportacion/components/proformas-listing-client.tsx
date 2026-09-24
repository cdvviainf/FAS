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
import { Icons } from '@/components/icons'
import { formatMonto } from '@/lib/format'
import { usePuedeEscribir } from '@/hooks/use-item-acceso'
import { proformasListOptions } from '../queries'
import type { EstadoProforma } from '../types'
import { NuevaProformaDialog } from './nueva-proforma-dialog'

const ITEM = 'FACT_EXPORTACION'

const ESTADO_LABELS: Record<EstadoProforma, string> = { EMITIDA: 'Emitida', ANULADA: 'Anulada' }

export function ProformasListingClient() {
  const router = useRouter()
  const puedeEscribir = usePuedeEscribir(ITEM)
  const [folio, setFolio] = useState('')
  const [estado, setEstado] = useState<EstadoProforma | 'TODOS'>('EMITIDA')
  const [page, setPage] = useState(1)
  const [nuevaOpen, setNuevaOpen] = useState(false)
  const limit = 20

  const { data, isPending } = useQuery(
    proformasListOptions({
      ...(estado !== 'TODOS' ? { estado } : {}),
      ...(folio.trim() ? { folio: folio.trim() } : {}),
      page,
      limit,
    }),
  )
  const proformas = data?.data ?? []
  const totalPages = data?.meta.totalPages ?? 1

  return (
    <div className='space-y-3'>
      <div className='flex flex-wrap items-end justify-between gap-3'>
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
          <div className='min-w-[160px] space-y-1.5'>
            <Label className='text-[10.5px] tracking-wide uppercase'>Estado</Label>
            <Select value={estado} onValueChange={(v) => { setEstado(v as EstadoProforma | 'TODOS'); setPage(1) }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value='TODOS'>Todos</SelectItem>
                {(Object.keys(ESTADO_LABELS) as EstadoProforma[]).map((e) => (
                  <SelectItem key={e} value={e}>{ESTADO_LABELS[e]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {puedeEscribir && (
          <Button onClick={() => setNuevaOpen(true)}>
            <Icons.add className='mr-2 h-4 w-4' /> Nueva Proforma
          </Button>
        )}
      </div>

      {isPending ? (
        <p className='text-muted-foreground text-sm'>Cargando...</p>
      ) : proformas.length === 0 ? (
        <p className='text-muted-foreground rounded-md border border-dashed p-8 text-center text-sm'>Sin Proformas.</p>
      ) : (
        <>
          <div className='overflow-x-auto rounded-md border'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Embarque</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className='text-right'>Monto</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {proformas.map((p) => (
                  <TableRow
                    key={p.id}
                    className='cursor-pointer'
                    onClick={() => router.push(`/dashboard/facturacion/exportacion/proforma/${p.id}`)}
                  >
                    <TableCell className='font-medium'>{p.codigo}</TableCell>
                    <TableCell>{p.embarque.numeroInstructivo}</TableCell>
                    <TableCell>{p.cliente.descripcion}</TableCell>
                    <TableCell className='text-muted-foreground'>{new Date(p.fechaEmision).toLocaleDateString('es-CL')}</TableCell>
                    <TableCell className='text-right tabular-nums'>{p.moneda.codigo} {formatMonto(p.montoTotal)}</TableCell>
                    <TableCell>
                      <Badge variant={p.estado === 'EMITIDA' ? 'default' : 'secondary'}>{ESTADO_LABELS[p.estado]}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className='flex items-center justify-between text-sm'>
            <p className='text-muted-foreground'>Página {page} de {totalPages} · {data?.meta.total ?? 0} proforma(s)</p>
            <div className='flex gap-2'>
              <Button variant='outline' size='sm' disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
              <Button variant='outline' size='sm' disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Siguiente</Button>
            </div>
          </div>
        </>
      )}

      <NuevaProformaDialog open={nuevaOpen} onOpenChange={setNuevaOpen} />
    </div>
  )
}
