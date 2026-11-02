'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Icons } from '@/components/icons'
import { formatFechaCorta } from '@/lib/format'
import { usePuedeEscribir } from '@/hooks/use-item-acceso'
import { proformasProductorListOptions } from '../queries'
import { ESTADO_PROFORMA_PRODUCTOR_LABELS, ESTADO_EMISION_LABELS } from '../types'
import type { EstadoProformaProductor, EstadoEmisionProforma } from '../types'

const ITEM = 'PRODUCTORES_PROFORMA'

const ESTADO_VARIANT: Record<EstadoProformaProductor, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  BORRADOR: 'secondary',
  ENVIADA_VALIDACION: 'default',
  RECHAZADA: 'destructive',
  FACTURADA: 'outline',
  ANULADA: 'destructive',
}

const EMISION_VARIANT: Record<EstadoEmisionProforma, 'default' | 'secondary'> = {
  EMITIDA: 'default',
  PENDIENTE: 'secondary',
}

export function ProformaProductorListingClient() {
  const router = useRouter()
  const puedeEscribir = usePuedeEscribir(ITEM)
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const limit = 20

  const { data, isPending } = useQuery({
    ...proformasProductorListOptions({ page, limit, ...(q.trim() ? { q: q.trim() } : {}) }),
    placeholderData: keepPreviousData,
  })
  const filas = data?.data ?? []
  const totalPages = data?.meta.totalPages ?? 1

  return (
    <div className='space-y-4'>
      <div className='flex flex-wrap items-end justify-between gap-3'>
        <div className='grid gap-1'>
          <label className='text-muted-foreground text-xs'>Buscar</label>
          <Input
            placeholder='N° proforma o productor…'
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setPage(1)
            }}
            className='w-64'
          />
        </div>
        {puedeEscribir && (
          <Button onClick={() => router.push('/dashboard/productores/proformas/nueva')}>
            <Icons.add className='mr-1 h-4 w-4' /> Nueva Proforma
          </Button>
        )}
      </div>

      {isPending ? (
        <p className='text-muted-foreground text-sm'>Cargando...</p>
      ) : filas.length === 0 ? (
        <p className='text-muted-foreground rounded-md border border-dashed p-8 text-center text-sm'>
          No hay proformas a productores registradas.
        </p>
      ) : (
        <>
          <div className='overflow-x-auto rounded-md border'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N° Proforma</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Productor</TableHead>
                  <TableHead>Moneda</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Emisión</TableHead>
                  <TableHead className='text-right'>Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filas.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className='font-mono text-sm'>{p.numero}</TableCell>
                    <TableCell className='text-muted-foreground'>{formatFechaCorta(p.creadoEn)}</TableCell>
                    <TableCell>
                      <p className='font-medium'>{p.entidad.descripcion}</p>
                      <p className='text-muted-foreground text-xs'>{p.entidad.razonSocial}</p>
                    </TableCell>
                    <TableCell className='text-sm'>{p.moneda.codigo}</TableCell>
                    <TableCell>
                      <Badge variant={ESTADO_VARIANT[p.estado]}>{ESTADO_PROFORMA_PRODUCTOR_LABELS[p.estado]}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={EMISION_VARIANT[p.estadoEmision]}>{ESTADO_EMISION_LABELS[p.estadoEmision]}</Badge>
                    </TableCell>
                    <TableCell className='text-right'>
                      <Button variant='outline' size='sm' onClick={() => router.push(`/dashboard/productores/proformas/${p.id}`)}>
                        {puedeEscribir ? 'Editar' : 'Ver'}
                      </Button>
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
    </div>
  )
}
