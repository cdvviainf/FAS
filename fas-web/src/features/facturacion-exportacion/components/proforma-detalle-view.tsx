'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Icons } from '@/components/icons'
import { formatMonto } from '@/lib/format'
import { usePuedeEscribir } from '@/hooks/use-item-acceso'
import { documentosService } from '@/features/documentos/service'
import { proformasKeys } from '../queries'
import { proformaService } from '../service'
import type { Proforma } from '../types'

const ITEM = 'FACT_EXPORTACION'

// Vista de detalle de una Proforma ya emitida (o anulada — FAS-PROF-EXP-003,
// QA ronda 2: el historial debe poder consultarse, no solo la activa del
// Embarque) — reusada desde la pantalla de emisión (Proforma activa del
// Embarque) y desde el detalle histórico por id (`/proforma/[id]`).
export function ProformaDetalleView({ proforma }: { proforma: Proforma }) {
  const queryClient = useQueryClient()
  const puedeEscribir = usePuedeEscribir(ITEM)

  const anular = useMutation({
    mutationFn: () => proformaService.anular(proforma.id),
    onSuccess: () => {
      toast.success('Proforma anulada')
      queryClient.invalidateQueries({ queryKey: proformasKeys.porEmbarque(proforma.embarqueId) })
      queryClient.invalidateQueries({ queryKey: proformasKeys.detalle(proforma.id) })
      queryClient.invalidateQueries({ queryKey: proformasKeys.all })
    },
    onError: (e: Error) => toast.error(e.message || 'Error al anular'),
  })

  return (
    <div className='max-w-3xl space-y-4'>
      <div className='flex items-start justify-between'>
        <div>
          <h2 className='flex items-center gap-2 text-xl font-semibold'>
            Proforma {proforma.codigo}
            <Badge variant={proforma.estado === 'EMITIDA' ? 'default' : 'secondary'}>
              {proforma.estado === 'EMITIDA' ? 'Emitida' : 'Anulada'}
            </Badge>
          </h2>
          <p className='text-muted-foreground text-sm'>
            Embarque {proforma.embarque.numeroInstructivo} · {proforma.cliente.descripcion} · {proforma.moneda.codigo}
            {proforma.condicionPago && <> · {proforma.condicionPago.descripcion}</>}
          </p>
        </div>
        <div className='flex gap-2'>
          {proforma.estado === 'EMITIDA' && (
            <Button variant='outline' onClick={() => documentosService.abrirPdf('proforma', proforma.id)}>
              <Icons.download className='mr-2 h-4 w-4' /> Ver PDF
            </Button>
          )}
          {puedeEscribir && proforma.estado === 'EMITIDA' && (
            <Button variant='outline' onClick={() => anular.mutate()} isLoading={anular.isPending}>
              Anular
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className='text-sm'>Líneas</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descripción</TableHead>
                <TableHead className='text-right'>Cajas</TableHead>
                <TableHead className='text-right'>Precio Unitario</TableHead>
                <TableHead className='text-right'>Monto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {proforma.lineas.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>{l.descripcion}</TableCell>
                  <TableCell className='text-right tabular-nums'>{formatMonto(l.cantidadCajas, 0)}</TableCell>
                  <TableCell className='text-right tabular-nums'>{proforma.moneda.codigo} {formatMonto(l.precioUnitario)}</TableCell>
                  <TableCell className='text-right tabular-nums'>{proforma.moneda.codigo} {formatMonto(l.montoLinea)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={3}>Total</TableCell>
                <TableCell className='text-right tabular-nums'>{proforma.moneda.codigo} {formatMonto(proforma.montoTotal)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
