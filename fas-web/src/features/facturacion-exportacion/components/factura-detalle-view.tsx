'use client'

import { toast } from 'sonner'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Icons } from '@/components/icons'
import { formatMonto, formatFechaCorta } from '@/lib/format'
import { usePuedeEscribir } from '@/hooks/use-item-acceso'
import { documentosService } from '@/features/documentos/service'
import { facturaExportacionService } from '../service'
import { facturasKeys, embarquesExportacionKeys } from '../queries'
import { FECHA_REFERENCIA_LABELS } from '../types'
import type { EstadoFacturaExportacion, FacturaExportacion } from '../types'

const ITEM = 'FACT_EXPORTACION'

const ESTADO_BADGE: Record<EstadoFacturaExportacion, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  BORRADOR: { label: 'Borrador', variant: 'outline' },
  APROBADA: { label: 'Aprobada', variant: 'default' },
  RECHAZADA: { label: 'Rechazada', variant: 'destructive' },
  ANULADA: { label: 'Anulada', variant: 'secondary' },
}

// Vista de solo lectura de una Factura de Exportación (aprobada o anulada).
export function FacturaDetalleView({ factura }: { factura: FacturaExportacion }) {
  const queryClient = useQueryClient()
  const puedeEscribir = usePuedeEscribir(ITEM)
  const badge = ESTADO_BADGE[factura.estado]
  const puedeDescargarXml = factura.estado === 'APROBADA' && (factura.dte?.tieneXml ?? false)
  // Defensa extra (FAS-EXP-IE-QA-003): el backend ya no debería dejar una
  // Factura APROBADA sin folio, pero se exige explícitamente igual.
  const puedeVerPdf = factura.estado === 'APROBADA' && factura.folio != null
  // NC de anulación aprobada (cuando la factura está ANULADA).
  const ncAprobada = factura.notasCredito?.find((n) => n.estado === 'APROBADA') ?? null

  const anularConNc = useMutation({
    mutationFn: () => facturaExportacionService.anularConNc(factura.id),
    onSuccess: (r) => {
      toast.success(`Factura anulada con Nota de Crédito ${r.data.codigo}${r.data.folio ? ` (folio ${r.data.folio})` : ''}`)
      queryClient.invalidateQueries({ queryKey: facturasKeys.detalle(factura.id) })
      queryClient.invalidateQueries({ queryKey: facturasKeys.all })
      queryClient.invalidateQueries({ queryKey: embarquesExportacionKeys.all })
    },
    onError: (e: Error) => toast.error(e.message || 'No se pudo anular la Factura con Nota de Crédito'),
  })

  async function verPdfNc() {
    if (!ncAprobada) return
    try {
      await facturaExportacionService.verPdfNc(ncAprobada.id)
    } catch (e) {
      toast.error((e as Error).message || 'No se pudo abrir el PDF de la Nota de Crédito')
    }
  }
  async function descargarXmlNc() {
    if (!ncAprobada) return
    try {
      await facturaExportacionService.descargarXmlNc(ncAprobada.id, `${ncAprobada.codigo}${ncAprobada.folio ? `-folio-${ncAprobada.folio}` : ''}.xml`)
    } catch (e) {
      toast.error((e as Error).message || 'No se pudo descargar el XML de la Nota de Crédito')
    }
  }

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
  // PDF tributario oficial: el DTE 110 timbrado (timbre + folio del SII) que
  // devuelve LibreDTE — no el documento comercial propio.
  async function verPdfTimbrado() {
    try {
      await facturaExportacionService.verPdfTimbrado(factura.id)
    } catch (e) {
      toast.error((e as Error).message || 'No se pudo abrir el PDF timbrado del SII')
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
    <div className='max-w-5xl space-y-4'>
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
            {factura.observaciones && (
              <>
                <dt className='font-medium'>Observaciones:</dt><dd className='whitespace-pre-wrap'>{factura.observaciones}</dd>
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
            <Button variant='outline' onClick={verPdfTimbrado}>
              <Icons.download className='mr-2 h-4 w-4' /> Ver DTE Timbrado (SII)
            </Button>
          )}
          {puedeDescargarXml && (
            <Button variant='outline' onClick={descargarXml}>
              <Icons.download className='mr-2 h-4 w-4' /> Descargar XML
            </Button>
          )}
          {/* Anular una factura timbrada con Nota de Crédito (DTE 112). */}
          {factura.estado === 'APROBADA' && puedeEscribir && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant='destructive' isLoading={anularConNc.isPending}>
                  <Icons.trash className='mr-2 h-4 w-4' /> Anular con Nota de Crédito
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Anular factura {factura.codigo} con Nota de Crédito</AlertDialogTitle>
                  <AlertDialogDescription>
                    Se emitirá y timbrará ante el SII una Nota de Crédito de Exportación (DTE 112) que anula esta
                    factura. La factura quedará ANULADA. Esta acción no se puede deshacer.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => anularConNc.mutate()}>Emitir NC y anular</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {ncAprobada && (
            <>
              <Button variant='outline' onClick={verPdfNc}>
                <Icons.download className='mr-2 h-4 w-4' /> Ver NC Timbrada (SII)
              </Button>
              <Button variant='outline' onClick={descargarXmlNc}>
                <Icons.download className='mr-2 h-4 w-4' /> Descargar XML NC
              </Button>
            </>
          )}
        </div>
      </div>

      {ncAprobada && (
        <p className='text-muted-foreground text-sm'>
          Anulada con Nota de Crédito <span className='font-medium'>{ncAprobada.codigo}</span>
          {ncAprobada.folio != null && <> · DTE {ncAprobada.tipoDte} folio {ncAprobada.folio}</>}
        </p>
      )}

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
