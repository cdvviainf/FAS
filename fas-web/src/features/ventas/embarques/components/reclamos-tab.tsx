'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Icons } from '@/components/icons'
import { usePuedeEscribir } from '@/hooks/use-item-acceso'
import { reclamosPorEmbarqueOptions } from '@/features/reclamos/queries'
import { ESTADO_RECLAMO_LABELS } from '@/features/reclamos/types'
import type { Reclamo } from '@/features/reclamos/types'
import { ReclamoFormDialog } from '@/features/reclamos/components/reclamo-form-dialog'
import type { EmbarqueDetalle } from '../types'

const ITEM = 'VENTAS_EMBARQUES'

// Creación/edición de Reclamos (reclamos.md) — vive acá, en el detalle del
// Embarque (Comercial). El análisis (comentario + documentos) y el resto
// del ciclo de vida vive en Calidad → Reclamos; el link de cada fila lleva
// para allá.
export function ReclamosTab({ embarque }: { embarque: EmbarqueDetalle }) {
  const puedeEscribir = usePuedeEscribir(ITEM)
  const router = useRouter()
  const [formOpen, setFormOpen] = useState(false)
  const [reclamoParaEditar, setReclamoParaEditar] = useState<Reclamo | undefined>()

  const { data, isPending } = useQuery(reclamosPorEmbarqueOptions(embarque.id))
  const reclamos = data?.data ?? []

  function abrirCrear() {
    setReclamoParaEditar(undefined)
    setFormOpen(true)
  }

  function abrirEditar(r: Reclamo, e: React.MouseEvent) {
    e.stopPropagation()
    setReclamoParaEditar(r)
    setFormOpen(true)
  }

  return (
    <div className='space-y-3'>
      {puedeEscribir && (
        <Button onClick={abrirCrear}>
          <Icons.add className='mr-2 h-4 w-4' /> Nuevo Reclamo
        </Button>
      )}

      {isPending ? (
        <p className='text-muted-foreground text-sm'>Cargando...</p>
      ) : reclamos.length === 0 ? (
        <p className='text-muted-foreground rounded-md border border-dashed p-6 text-center text-sm'>
          Este Embarque no tiene reclamos.
        </p>
      ) : (
        <div className='overflow-x-auto rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Resumen</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className='text-right'>Cajas</TableHead>
                <TableHead className='text-right'>Provisión vigente</TableHead>
                <TableHead className='text-right'>Valorización</TableHead>
                <TableHead className='w-10'></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reclamos.map((r) => {
                const cajas = r.lineas.reduce((acc, l) => acc + l.cantidadCajas, 0)
                const provisionVigente = r.provisiones.find((p) => p.estado === 'VIGENTE')
                return (
                  <TableRow
                    key={r.id}
                    className='cursor-pointer'
                    onClick={() => router.push(`/dashboard/calidad/reclamos/${r.id}`)}
                  >
                    <TableCell className='text-muted-foreground'>{r.fechaReclamo ?? '—'}</TableCell>
                    <TableCell className='max-w-xs truncate'>{r.resumenCliente ?? '—'}</TableCell>
                    <TableCell><Badge variant='outline'>{ESTADO_RECLAMO_LABELS[r.estado]}</Badge></TableCell>
                    <TableCell className='text-right tabular-nums'>{cajas}</TableCell>
                    <TableCell className='text-right tabular-nums'>
                      {provisionVigente ? `${r.moneda.codigo} ${provisionVigente.montoCalculado}` : '—'}
                    </TableCell>
                    <TableCell className='text-right tabular-nums'>
                      {r.valorConfirmado != null ? `${r.moneda.codigo} ${r.valorConfirmado}` : '—'}
                    </TableCell>
                    <TableCell>
                      {puedeEscribir && r.estado !== 'CERRADO' && (
                        <Button variant='ghost' size='icon' className='h-8 w-8' onClick={(e) => abrirEditar(r, e)}>
                          <Icons.edit className='h-4 w-4' />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <ReclamoFormDialog embarqueId={embarque.id} open={formOpen} onOpenChange={setFormOpen} reclamoParaEditar={reclamoParaEditar} />
    </div>
  )
}
