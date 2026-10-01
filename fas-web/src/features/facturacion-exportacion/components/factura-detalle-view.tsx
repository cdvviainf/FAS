'use client'

import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Icons } from '@/components/icons'
import { formatMonto, formatFechaCorta } from '@/lib/format'
import { documentosService } from '@/features/documentos/service'
import { facturaExportacionService } from '../service'
import { FECHA_REFERENCIA_LABELS } from '../types'
import type { EstadoFacturaExportacion, FacturaExportacion } from '../types'

const ESTADO_BADGE: Record<EstadoFacturaExportacion, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  BORRADOR: { label: 'Borrador', variant: 'outline' },
  APROBADA: { label: 'Aprobada', variant: 'default' },
  RECHAZADA: { label: 'Rechazada', variant: 'destructive' },
  ANULADA: { label: 'Anulada', variant: 'secondary' },
}

// Vista de solo lectura de una Factura de Exportación (aprobada o anulada).
export function FacturaDetalleView({ factura }: { factura: FacturaExportacion }) {
  const badge = ESTADO_BADGE[factura.estado]
  const puedeDescargarXml = factura.estado === 'APROBADA' && (factura.dte?.tieneXml ?? false)
  // Defensa extra (FAS-EXP-IE-QA-003): el backend ya no debería dejar una
  // Factura APROBADA sin folio, pero se exige explícitamente igual.
  const puedeVerPdf = factura.estado === 'APROBADA' && factura.folio != null

  async function descargarXml() {
    try {
      await facturaExportacionService.descargarXml(factura.id, `${factura.codigo}${factura.folio ? `-folio-${factura.folio}` : ''}.xml`)
    } catch (e) {
      toast.error((e as Error).message || 'No se pudo descargar el XML')
    }
  }
  // "Ver Cierre Comercial"/"Ver Proforma" abren directamente su PDF
  // (2026-09-30) — antes navegaban a la pantalla.
  async function abrirPdfCierre(notaVentaId: number) {
    try {
      await documentosService.abrirPdf('cierre-comercial', notaVentaId)
    } catch (e) {
      toast.error((e as Error).message || 'No se pudo abrir el PDF del Cierre Comercial')
    }
  }
  async function abrirPdfProforma(proformaId: number) {
    try {
      await documentosService.abrirPdf('proforma', proformaId)
    } catch (e) {
      toast.error((e as Error).message || 'No se pudo abrir el PDF de la Proforma')
    }
  }
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
      <div className='flex items-start justify-between gap-3'>
        <div>
          <h2 className='flex items-center gap-2 text-xl font-semibold'>
            Factura {factura.codigo}
            <Badge variant={badge.variant}>{badge.label}</Badge>
          </h2>
          <dl className='text-muted-foreground mt-1 grid gap-x-2 text-sm sm:grid-cols-[auto_1fr]'>
            <dt className='font-medium'>Embarque:</dt><dd>{factura.embarque.numeroInstructivo}</dd>
            <dt className='font-medium'>Cliente:</dt><dd>{factura.cliente.descripcion}</dd>
            <dt className='font-medium'>Moneda:</dt><dd>{factura.moneda.codigo}</dd>
            {factura.tipoCambio != null && (
              <>
                <dt className='font-medium'>Tipo de cambio:</dt>
                <dd>
                  {formatMonto(Number(factura.tipoCambio), 2)} CLP/{factura.moneda.codigo}
                  {factura.fechaTipoCambio && <> · {formatFechaCorta(factura.fechaTipoCambio)}</>}
                </dd>
              </>
            )}
            {factura.condicionPago && (
              <>
                <dt className='font-medium'>Condición de pago:</dt><dd>{factura.condicionPago.descripcion}</dd>
              </>
            )}
          </dl>
          <p className='text-muted-foreground mt-1 text-sm'>
            DTE {factura.tipoDte}
            {factura.folio != null && <> · Folio {factura.folio}</>}
            {(factura.fechaDocumento ?? factura.fechaEmision) && <> · Fecha {formatFechaCorta((factura.fechaDocumento ?? factura.fechaEmision)!)}</>}
            {factura.proforma && <> · desde Proforma {factura.proforma.codigo}</>}
          </p>
        </div>
        <div className='flex flex-wrap justify-end gap-2'>
          {factura.embarque.notaVentaId != null && (
            <Button variant='outline' onClick={() => abrirPdfCierre(factura.embarque.notaVentaId!)}>
              <Icons.externalLink className='mr-2 h-4 w-4' /> Ver Cierre Comercial
            </Button>
          )}
          {factura.proforma && (
            <Button variant='outline' onClick={() => abrirPdfProforma(factura.proforma!.id)}>
              <Icons.billing className='mr-2 h-4 w-4' /> Ver Proforma {factura.proforma.codigo}
            </Button>
          )}
          {puedeVerPdf && (
            <Button variant='outline' onClick={() => documentosService.abrirPdf('factura-exportacion', factura.id)}>
              <Icons.download className='mr-2 h-4 w-4' /> Ver Factura Comercial (PDF)
            </Button>
          )}
          {puedeDescargarXml && (
            <Button variant='outline' onClick={descargarXml}>
              <Icons.download className='mr-2 h-4 w-4' /> Descargar XML
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
