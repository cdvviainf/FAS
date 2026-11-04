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
import { generadorDteListOptions } from '../queries'
import { CLASE_LABELS, ESTADO_LABELS } from '../types'
import type { ClaseDocumentoManual, EstadoDocumentoManual } from '../types'

const ITEM = 'GENERADOR_DTE'

const ESTADO_VARIANT: Record<EstadoDocumentoManual, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  BORRADOR: 'secondary',
  ENVIADA_SII: 'default',
  APROBADA: 'outline',
  RECHAZADA: 'destructive',
  ANULADA: 'destructive',
}

export function GeneradorDteListingClient() {
  const router = useRouter()
  const puedeEscribir = usePuedeEscribir(ITEM)
  const [q, setQ] = useState('')
  const [clase, setClase] = useState<ClaseDocumentoManual | '__all__'>('__all__')
  const [page, setPage] = useState(1)
  const limit = 20

  const { data, isPending } = useQuery({
    ...generadorDteListOptions({
      page,
      limit,
      ...(q.trim() ? { q: q.trim() } : {}),
      ...(clase !== '__all__' ? { claseDocumento: clase } : {}),
    }),
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
              placeholder='N° documento o receptor…'
              value={q}
              onChange={(e) => {
                setQ(e.target.value)
                setPage(1)
              }}
              className='w-64'
            />
          </div>
          <div className='grid gap-1'>
            <label className='text-muted-foreground text-xs'>Tipo de documento</label>
            <Select
              value={clase}
              onValueChange={(v) => {
                setClase(v as ClaseDocumentoManual | '__all__')
                setPage(1)
              }}
            >
              <SelectTrigger className='w-56'><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value='__all__'>Todos</SelectItem>
                {(Object.keys(CLASE_LABELS) as ClaseDocumentoManual[]).map((c) => (
                  <SelectItem key={c} value={c}>{CLASE_LABELS[c]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {puedeEscribir && (
          <Button onClick={() => router.push('/dashboard/facturacion/generador-dte/nueva')}>
            <Icons.add className='mr-1 h-4 w-4' /> Nuevo documento
          </Button>
        )}
      </div>

      {isPending ? (
        <p className='text-muted-foreground text-sm'>Cargando...</p>
      ) : filas.length === 0 ? (
        <p className='text-muted-foreground rounded-md border border-dashed p-8 text-center text-sm'>
          No hay documentos registrados.
        </p>
      ) : (
        <>
          <div className='overflow-x-auto rounded-md border'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N° Documento</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Receptor</TableHead>
                  <TableHead>Moneda</TableHead>
                  <TableHead className='text-right'>Total</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className='text-right'>Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filas.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className='font-mono text-sm'>{doc.codigo}</TableCell>
                    <TableCell className='text-sm'>
                      {CLASE_LABELS[doc.claseDocumento]} <span className='text-muted-foreground'>({doc.tipoDte})</span>
                    </TableCell>
                    <TableCell className='text-muted-foreground'>{formatFechaCorta(doc.fechaDocumento)}</TableCell>
                    <TableCell>
                      <p className='font-medium'>{doc.entidad.descripcion}</p>
                      <p className='text-muted-foreground text-xs'>{doc.entidad.razonSocial}</p>
                    </TableCell>
                    <TableCell className='text-sm'>{doc.moneda.codigo}</TableCell>
                    <TableCell className='text-right tabular-nums'>{formatMonto(doc.montoTotal)}</TableCell>
                    <TableCell>
                      <Badge variant={ESTADO_VARIANT[doc.estado]}>{ESTADO_LABELS[doc.estado]}</Badge>
                    </TableCell>
                    <TableCell className='text-right'>
                      <Button variant='outline' size='sm' onClick={() => router.push(`/dashboard/facturacion/generador-dte/${doc.id}`)}>
                        {puedeEscribir ? 'Editar' : 'Ver'}
                      </Button>
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
