'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatMonto, formatFechaCorta } from '@/lib/format'
import { FECHA_REFERENCIA_LABELS } from '../types'
import type { FacturaExportacion } from '../types'

// Vista de solo lectura de una Factura de Exportación ya emitida (o anulada).
export function FacturaDetalleView({ factura }: { factura: FacturaExportacion }) {
  const emitida = factura.estado === 'EMITIDA'
  // Desglose de la cláusula de venta: el flete/seguro restan al valor de venta
  // para dar el valor FOB de la mercadería (lo que se timbra en el detalle).
  const montoTotal = Number(factura.montoTotal)
  const montoFlete = factura.montoFlete == null ? null : Number(factura.montoFlete)
  const montoSeguro = factura.montoSeguro == null ? null : Number(factura.montoSeguro)
  const tieneDesglose = montoFlete != null || montoSeguro != null
  const reduccion = (montoFlete ?? 0) + (montoSeguro ?? 0)
  const factor = montoTotal > 0 && reduccion > 0 ? (montoTotal - reduccion) / montoTotal : 1
  const subtotalFob = Math.round((montoTotal - reduccion) * 100) / 100
  const moneda = factura.moneda.codigo
  return (
    <div className='max-w-3xl space-y-4'>
      <div>
        <h2 className='flex items-center gap-2 text-xl font-semibold'>
          Factura {factura.codigo}
          <Badge variant={emitida ? 'default' : 'secondary'}>{emitida ? 'Emitida' : 'Anulada'}</Badge>
        </h2>
        <p className='text-muted-foreground text-sm'>
          Embarque {factura.embarque.numeroInstructivo} · {factura.cliente.descripcion} · {factura.moneda.codigo}
          {factura.condicionPago && <> · {factura.condicionPago.descripcion}</>}
        </p>
        <p className='text-muted-foreground text-sm'>
          DTE {factura.tipoDte}
          {factura.folio != null && <> · Folio {factura.folio}</>}
          {factura.fechaEmision && <> · Emitida {formatFechaCorta(factura.fechaEmision)}</>}
          {factura.proforma && <> · desde Proforma {factura.proforma.codigo}</>}
        </p>
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
              {factura.lineas.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>{l.descripcion}</TableCell>
                  <TableCell className='text-right tabular-nums'>{formatMonto(l.cantidadCajas, 0)}</TableCell>
                  <TableCell className='text-right tabular-nums'>{moneda} {formatMonto(Number(l.precioUnitario) * factor, 4)}</TableCell>
                  <TableCell className='text-right tabular-nums'>{moneda} {formatMonto(Number(l.montoLinea) * factor)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={3}>{tieneDesglose ? 'Valor FOB (mercadería)' : 'Total'}</TableCell>
                <TableCell className='text-right tabular-nums'>{moneda} {formatMonto(tieneDesglose ? subtotalFob : montoTotal)}</TableCell>
              </TableRow>
              {montoFlete != null && (
                <TableRow>
                  <TableCell colSpan={3}>Flete</TableCell>
                  <TableCell className='text-right tabular-nums'>{moneda} {formatMonto(montoFlete)}</TableCell>
                </TableRow>
              )}
              {montoSeguro != null && (
                <TableRow>
                  <TableCell colSpan={3}>Seguro</TableCell>
                  <TableCell className='text-right tabular-nums'>{moneda} {formatMonto(montoSeguro)}</TableCell>
                </TableRow>
              )}
              {tieneDesglose && (
                <TableRow>
                  <TableCell colSpan={3} className='font-semibold'>Total (valor cláusula)</TableCell>
                  <TableCell className='text-right font-semibold tabular-nums'>{moneda} {formatMonto(montoTotal)}</TableCell>
                </TableRow>
              )}
            </TableFooter>
          </Table>
        </CardContent>
      </Card>

      {factura.cuotas.length > 0 && (
        <Card>
          <CardHeader><CardTitle className='text-sm'>Cuotas</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cuota</TableHead>
                  <TableHead>Referencia</TableHead>
                  <TableHead className='text-right'>Días</TableHead>
                  <TableHead>Vencimiento</TableHead>
                  <TableHead className='text-right'>Monto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {factura.cuotas.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className='tabular-nums'>#{c.numeroCuota}</TableCell>
                    <TableCell>{FECHA_REFERENCIA_LABELS[c.fechaReferencia]}</TableCell>
                    <TableCell className='text-right tabular-nums'>{c.plazoDias}</TableCell>
                    <TableCell>{c.fechaVencimiento ? formatFechaCorta(c.fechaVencimiento) : 'Pendiente'}</TableCell>
                    <TableCell className='text-right tabular-nums'>{factura.moneda.codigo} {formatMonto(c.montoCuota)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
