'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Icons } from '@/components/icons'
import { formatFechaCorta } from '@/lib/format'
import { embarquesExportacionListOptions } from '../queries'
import type { EmbarqueExportacionRow, EstadoFacturaExportacion } from '../types'

// Etiquetas/estilos de estado para las columnas Proforma y SII.
const PROFORMA_BADGE = { EMITIDA: { label: 'Emitida', variant: 'default' }, ANULADA: { label: 'Anulada', variant: 'secondary' } } as const

const SII_BADGE: Record<EstadoFacturaExportacion, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  BORRADOR: { label: 'Borrador', variant: 'outline' },
  APROBADA: { label: 'Aprobada', variant: 'default' },
  RECHAZADA: { label: 'Rechazada', variant: 'destructive' },
  ANULADA: { label: 'Anulada', variant: 'secondary' },
}

export function EmbarquesExportacionListingClient() {
  const router = useRouter()
  const [folio, setFolio] = useState('')
  const [page, setPage] = useState(1)
  const limit = 20

  const { data, isPending } = useQuery(
    embarquesExportacionListOptions({ ...(folio.trim() ? { folio: folio.trim() } : {}), page, limit }),
  )
  const filas = data?.data ?? []
  const totalPages = data?.meta.totalPages ?? 1

  function irAProforma(row: EmbarqueExportacionRow) {
    router.push(`/dashboard/facturacion/exportacion/${row.id}`)
  }
  function irAFactura(row: EmbarqueExportacionRow) {
    const factura = row.facturasExportacion[0]
    if (factura) router.push(`/dashboard/facturacion/exportacion/factura/${factura.id}`)
    else irAProforma(row) // sin factura aún: se genera desde la Proforma
  }

  return (
    <div className='space-y-3'>
      <div className='flex flex-wrap items-end gap-3'>
        <div className='min-w-[180px] space-y-1.5'>
          <Label className='text-[10.5px] tracking-wide uppercase'>Folio Embarque</Label>
          <Input value={folio} onChange={(e) => { setFolio(e.target.value); setPage(1) }} placeholder='Ej. MAR0042' className='h-9' />
        </div>
      </div>

      {isPending ? (
        <p className='text-muted-foreground text-sm'>Cargando...</p>
      ) : filas.length === 0 ? (
        <p className='text-muted-foreground rounded-md border border-dashed p-8 text-center text-sm'>Sin embarques despachados.</p>
      ) : (
        <>
          <div className='overflow-x-auto rounded-md border'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Embarque</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Despacho</TableHead>
                  <TableHead>Proforma</TableHead>
                  <TableHead>SII</TableHead>
                  <TableHead className='text-right'>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filas.map((row) => {
                  const proforma = row.proformas[0] ?? null
                  const factura = row.facturasExportacion[0] ?? null
                  const proformaBadge = proforma ? PROFORMA_BADGE[proforma.estado] : null
                  const siiBadge = factura ? SII_BADGE[factura.estado] : null
                  return (
                    <TableRow key={row.id}>
                      <TableCell className='font-medium'>{row.numeroInstructivo}</TableCell>
                      <TableCell>{row.notaVenta?.cliente.razonSocial ?? '—'}</TableCell>
                      <TableCell className='text-muted-foreground'>{row.despachadoEn ? formatFechaCorta(row.despachadoEn) : '—'}</TableCell>
                      <TableCell>
                        {proformaBadge ? (
                          <Badge variant={proformaBadge.variant}>{proformaBadge.label}</Badge>
                        ) : (
                          <Badge variant='outline'>Pendiente</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {siiBadge ? (
                          <Badge variant={siiBadge.variant}>{siiBadge.label}{factura?.folio ? ` · ${factura.folio}` : ''}</Badge>
                        ) : (
                          <Badge variant='outline'>Pendiente</Badge>
                        )}
                      </TableCell>
                      <TableCell className='text-right'>
                        <div className='flex justify-end gap-2'>
                          <Button variant='outline' size='sm' onClick={() => irAProforma(row)}>
                            <Icons.billing className='mr-1 h-3.5 w-3.5' />
                            {proforma ? 'Ver Proforma' : 'Emitir Proforma'}
                          </Button>
                          {proforma?.estado === 'EMITIDA' && (
                            <Button variant='outline' size='sm' onClick={() => irAFactura(row)}>
                              <Icons.billing className='mr-1 h-3.5 w-3.5' />
                              {factura ? 'Ver Factura' : 'Generar Factura'}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
          <div className='flex items-center justify-between text-sm'>
            <p className='text-muted-foreground'>Página {page} de {totalPages} · {data?.meta.total ?? 0} embarque(s)</p>
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
