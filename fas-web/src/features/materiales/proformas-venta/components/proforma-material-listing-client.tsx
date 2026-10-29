'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Icons } from '@/components/icons'
import { formatFechaCorta } from '@/lib/format'
import { usePuedeEscribir } from '@/hooks/use-item-acceso'
import { movimientosRequierenProformaOptions } from '../queries'
import { ESTADO_PROFORMA_MATERIAL_LABELS } from '../types'
import type { EstadoProformaMaterial, MovimientoRequiereProforma } from '../types'

const ITEM = 'MATERIALES_PROFORMA'

// Estilo del badge de estado de la proforma por cada movimiento.
const PROFORMA_BADGE: Record<EstadoProformaMaterial, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  BORRADOR: 'outline',
  ENVIADA_VALIDACION: 'default',
  FACTURADA: 'default',
  ANULADA: 'secondary',
}

export function ProformaMaterialListingClient() {
  const router = useRouter()
  const puedeEscribir = usePuedeEscribir(ITEM)
  const [page, setPage] = useState(1)
  const limit = 20

  const { data, isPending } = useQuery({
    ...movimientosRequierenProformaOptions({ page, limit }),
    placeholderData: keepPreviousData,
  })
  const filas = data?.data ?? []
  const totalPages = data?.meta.totalPages ?? 1

  function emitir(mov: MovimientoRequiereProforma) {
    router.push(`/dashboard/operaciones/materiales/proformas/nueva?movimientoId=${mov.id}`)
  }
  function ver(proformaId: number) {
    router.push(`/dashboard/operaciones/materiales/proformas/${proformaId}`)
  }

  return (
    <div className='space-y-3'>
      {isPending ? (
        <p className='text-muted-foreground text-sm'>Cargando...</p>
      ) : filas.length === 0 ? (
        <p className='text-muted-foreground rounded-md border border-dashed p-8 text-center text-sm'>
          No hay movimientos de salida confirmados que requieran proforma.
        </p>
      ) : (
        <>
          <div className='overflow-x-auto rounded-md border'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Movimiento</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Bodega</TableHead>
                  <TableHead>Proforma</TableHead>
                  <TableHead className='text-right'>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filas.map((mov) => {
                  const p = mov.proforma
                  return (
                    <TableRow key={mov.id}>
                      <TableCell className='font-medium'>
                        #{mov.id} · {mov.tipoMovimiento.descripcion}
                      </TableCell>
                      <TableCell className='text-muted-foreground'>{formatFechaCorta(mov.fechaMovimiento)}</TableCell>
                      <TableCell>{mov.entidad?.razonSocial || mov.entidad?.descripcion || '—'}</TableCell>
                      <TableCell className='text-muted-foreground'>{mov.bodegaOrigen?.descripcion ?? '—'}</TableCell>
                      <TableCell>
                        {p ? (
                          <Badge variant={PROFORMA_BADGE[p.estado]}>
                            {ESTADO_PROFORMA_MATERIAL_LABELS[p.estado]} · {p.numero}
                          </Badge>
                        ) : (
                          <Badge variant='outline'>Pendiente</Badge>
                        )}
                      </TableCell>
                      <TableCell className='text-right'>
                        {p ? (
                          <Button variant='outline' size='sm' onClick={() => ver(p.id)}>
                            <Icons.billing className='mr-1 h-3.5 w-3.5' />
                            Ver Proforma
                          </Button>
                        ) : (
                          puedeEscribir && (
                            <Button variant='outline' size='sm' onClick={() => emitir(mov)}>
                              <Icons.add className='mr-1 h-3.5 w-3.5' />
                              Emitir Proforma
                            </Button>
                          )
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
          <div className='flex items-center justify-between text-sm'>
            <p className='text-muted-foreground'>Página {page} de {totalPages} · {data?.meta.total ?? 0} movimiento(s)</p>
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
