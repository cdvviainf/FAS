'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Icons } from '@/components/icons'
import { AlertModal } from '@/components/modal/alert-modal'
import { formatMonto } from '@/lib/format'
import { usePuedeEscribir } from '@/hooks/use-item-acceso'
import { facturasKeys } from '../queries'
import { facturaExportacionService, proformaService } from '../service'
import { DIMENSION_LABELS } from '../types'
import type { DimensionProforma, FacturaExportacion, ProformaLineaSugerida } from '../types'

const ITEM = 'FACT_EXPORTACION'
const TODAS_LAS_DIMENSIONES: DimensionProforma[] = ['VARIEDAD', 'ARTICULO', 'CALIBRE', 'CATEGORIA', 'MARCA']

function lineasDesdeFactura(factura: FacturaExportacion): ProformaLineaSugerida[] {
  return factura.lineas.map((l) => ({
    descripcion: l.descripcion,
    especieId: l.especieId,
    variedadId: l.variedadId,
    articuloId: l.articuloId,
    calibreId: l.calibreId,
    categoriaId: l.categoriaId,
    etiquetaId: l.etiquetaId,
    cantidadCajas: l.cantidadCajas,
    montoLinea: Number(l.montoLinea),
    precioUnitario: Number(l.precioUnitario),
  }))
}

export function FacturaEditor({ factura }: { factura: FacturaExportacion }) {
  const queryClient = useQueryClient()
  const puedeEscribir = usePuedeEscribir(ITEM)
  const embarqueId = factura.embarque.id

  const [dimensiones, setDimensiones] = useState<DimensionProforma[]>(factura.dimensionesAgrupacion)
  const [lineas, setLineas] = useState<ProformaLineaSugerida[]>(() => lineasDesdeFactura(factura))
  const [regrupando, setRegrupando] = useState(false)
  const [confirmarEmision, setConfirmarEmision] = useState(false)

  const clausula = factura.embarque.notaVenta?.clausulaVenta ?? null
  const requiereFlete = clausula?.requiereFlete ?? false
  const requiereSeguro = clausula?.requiereSeguro ?? false
  const [montoFlete, setMontoFlete] = useState<string>(factura.montoFlete ?? '')
  const [montoSeguro, setMontoSeguro] = useState<string>(factura.montoSeguro ?? '')

  const montoTotal = lineas.reduce((acc, l) => acc + l.montoLinea, 0)
  // Valor FOB de la mercadería = total (cláusula/CIF) − flete − seguro. Es lo
  // que se timbra en el detalle del DTE; el total sigue siendo el valor CIF.
  const fleteNum = requiereFlete ? Number(montoFlete) || 0 : 0
  const seguroNum = requiereSeguro ? Number(montoSeguro) || 0 : 0
  const subtotalFob = Math.round((montoTotal - fleteNum - seguroNum) * 100) / 100

  async function toggleDimension(dim: DimensionProforma, marcado: boolean) {
    const nuevas = marcado ? [...dimensiones, dim] : dimensiones.filter((d) => d !== dim)
    setDimensiones(nuevas)
    // Reagrupar recalcula las líneas canónicas contra los pallets reales (mismo
    // endpoint que la Proforma) — resetea los precios a los sugeridos.
    setRegrupando(true)
    try {
      const res = await proformaService.sugerirLineas(embarqueId, nuevas)
      setLineas(res.data)
    } catch {
      toast.error('No se pudieron recalcular las líneas')
    } finally {
      setRegrupando(false)
    }
  }

  function actualizarLinea(index: number, cambios: Partial<ProformaLineaSugerida>) {
    setLineas((prev) =>
      prev.map((l, i) => {
        if (i !== index) return l
        const actualizada = { ...l, ...cambios }
        actualizada.montoLinea = Math.round(actualizada.precioUnitario * actualizada.cantidadCajas * 100) / 100
        return actualizada
      }),
    )
  }

  const guardar = useMutation({
    mutationFn: () =>
      facturaExportacionService.actualizar(factura.id, {
        dimensiones,
        lineas: lineas.map((l) => ({
          descripcion: l.descripcion,
          especieId: l.especieId,
          variedadId: l.variedadId,
          articuloId: l.articuloId,
          calibreId: l.calibreId,
          categoriaId: l.categoriaId,
          etiquetaId: l.etiquetaId,
          cantidadCajas: l.cantidadCajas,
          precioUnitario: l.precioUnitario,
        })),
        montoFlete: requiereFlete ? Number(montoFlete) || 0 : null,
        montoSeguro: requiereSeguro ? Number(montoSeguro) || 0 : null,
      }),
    onSuccess: () => {
      toast.success('Factura guardada')
      queryClient.invalidateQueries({ queryKey: facturasKeys.detalle(factura.id) })
      queryClient.invalidateQueries({ queryKey: facturasKeys.all })
    },
    onError: (e: Error) => toast.error(e.message || 'Error al guardar la Factura'),
  })

  const emitir = useMutation({
    mutationFn: () => facturaExportacionService.emitir(factura.id),
    onSuccess: () => {
      toast.success('Factura emitida y timbrada')
      queryClient.invalidateQueries({ queryKey: facturasKeys.detalle(factura.id) })
      queryClient.invalidateQueries({ queryKey: facturasKeys.porEmbarque(factura.embarqueId) })
      queryClient.invalidateQueries({ queryKey: facturasKeys.all })
    },
    onError: (e: Error) => toast.error(e.message || 'Error al emitir el DTE'),
    onSettled: () => setConfirmarEmision(false),
  })

  function handleEmitir() {
    if (requiereFlete && (!montoFlete || Number(montoFlete) <= 0)) {
      toast.error('La cláusula de venta exige informar el monto de Flete')
      return
    }
    if (requiereSeguro && (!montoSeguro || Number(montoSeguro) <= 0)) {
      toast.error('La cláusula de venta exige informar el monto de Seguro')
      return
    }
    if ((requiereFlete || requiereSeguro) && subtotalFob <= 0) {
      toast.error('El Flete y el Seguro no pueden igualar ni superar el valor de venta')
      return
    }
    setConfirmarEmision(true)
  }

  return (
    <div className='max-w-3xl space-y-4'>
      <div className='flex items-start justify-between'>
        <div>
          <h2 className='flex items-center gap-2 text-xl font-semibold'>
            Factura {factura.codigo}
            <Badge variant='secondary'>Borrador</Badge>
          </h2>
          <p className='text-muted-foreground text-sm'>
            Embarque {factura.embarque.numeroInstructivo} · {factura.cliente.descripcion} · {factura.moneda.codigo}
            {factura.proforma && <> · desde Proforma {factura.proforma.codigo}</>}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className='text-sm'>Agrupación de líneas</CardTitle></CardHeader>
        <CardContent className='space-y-3'>
          <p className='text-muted-foreground text-xs'>
            Especie siempre se factura por separado. Marca qué más quieres desglosar (al cambiar, se recalculan las líneas).
          </p>
          <div className='flex flex-wrap gap-4'>
            {TODAS_LAS_DIMENSIONES.map((dim) => (
              <label key={dim} className='flex items-center gap-2 text-sm'>
                <Checkbox
                  checked={dimensiones.includes(dim)}
                  disabled={regrupando || !puedeEscribir}
                  onCheckedChange={(c) => toggleDimension(dim, !!c)}
                />
                {DIMENSION_LABELS[dim]}
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className='text-sm'>Líneas</CardTitle></CardHeader>
        <CardContent>
          {regrupando ? (
            <p className='text-muted-foreground text-sm'>Recalculando...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descripción</TableHead>
                  <TableHead className='text-right'>Cajas</TableHead>
                  <TableHead className='w-36 text-right'>Precio Unitario</TableHead>
                  <TableHead className='w-36 text-right'>Total Línea</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lineas.map((l, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Input
                        value={l.descripcion}
                        onChange={(e) => actualizarLinea(i, { descripcion: e.target.value })}
                        className='h-8'
                        disabled={!puedeEscribir}
                      />
                    </TableCell>
                    <TableCell className='text-right tabular-nums'>{formatMonto(l.cantidadCajas, 0)}</TableCell>
                    <TableCell>
                      <Input
                        type='number'
                        min={0}
                        step='0.0001'
                        value={l.precioUnitario}
                        onChange={(e) => actualizarLinea(i, { precioUnitario: Number(e.target.value) })}
                        className='h-8 text-right'
                        disabled={!puedeEscribir}
                      />
                    </TableCell>
                    <TableCell className='text-right tabular-nums'>{formatMonto(l.montoLinea)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell>Total</TableCell>
                  <TableCell className='text-right tabular-nums'>{formatMonto(lineas.reduce((a, l) => a + l.cantidadCajas, 0), 0)}</TableCell>
                  <TableCell />
                  <TableCell className='text-right tabular-nums'>{factura.moneda.codigo} {formatMonto(montoTotal)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </CardContent>
      </Card>

      {(requiereFlete || requiereSeguro) && (
        <Card>
          <CardHeader>
            <CardTitle className='text-sm'>
              Cláusula de venta{clausula?.descripcion ? ` — ${clausula.descripcion}` : ''}
            </CardTitle>
          </CardHeader>
          <CardContent className='space-y-3'>
            <p className='text-muted-foreground text-xs'>
              El Flete y el Seguro son un monto cerrado dentro del total: restan al valor de venta para obtener el
              valor FOB de la mercadería (lo que se timbra en el detalle del DTE). El total y las cuotas siguen sobre el
              valor de la cláusula.
            </p>
            <div className='flex flex-wrap gap-4'>
              {requiereFlete && (
                <div className='space-y-1.5'>
                  <label className='text-sm font-medium'>Flete ({factura.moneda.codigo}) *</label>
                  <Input
                    type='number'
                    min={0}
                    step='0.01'
                    value={montoFlete}
                    onChange={(e) => setMontoFlete(e.target.value)}
                    className='h-8 w-40 text-right'
                    disabled={!puedeEscribir}
                  />
                </div>
              )}
              {requiereSeguro && (
                <div className='space-y-1.5'>
                  <label className='text-sm font-medium'>Seguro ({factura.moneda.codigo}) *</label>
                  <Input
                    type='number'
                    min={0}
                    step='0.01'
                    value={montoSeguro}
                    onChange={(e) => setMontoSeguro(e.target.value)}
                    className='h-8 w-40 text-right'
                    disabled={!puedeEscribir}
                  />
                </div>
              )}
            </div>
            <div className='space-y-1 border-t pt-2 text-sm tabular-nums'>
              <div className='flex justify-between'>
                <span className='text-muted-foreground'>Valor FOB (mercadería)</span>
                <span>{factura.moneda.codigo} {formatMonto(subtotalFob)}</span>
              </div>
              {requiereFlete && (
                <div className='flex justify-between'>
                  <span className='text-muted-foreground'>Flete</span>
                  <span>{factura.moneda.codigo} {formatMonto(fleteNum)}</span>
                </div>
              )}
              {requiereSeguro && (
                <div className='flex justify-between'>
                  <span className='text-muted-foreground'>Seguro</span>
                  <span>{factura.moneda.codigo} {formatMonto(seguroNum)}</span>
                </div>
              )}
              <div className='flex justify-between font-semibold'>
                <span>Total (valor cláusula)</span>
                <span>{factura.moneda.codigo} {formatMonto(montoTotal)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {puedeEscribir && (
        <div className='flex gap-2'>
          <Button variant='outline' onClick={() => guardar.mutate()} isLoading={guardar.isPending} disabled={regrupando}>
            <Icons.check className='mr-2 h-4 w-4' /> Guardar
          </Button>
          <Button onClick={handleEmitir} disabled={regrupando || lineas.length === 0}>
            <Icons.billing className='mr-2 h-4 w-4' /> Emitir DTE
          </Button>
        </div>
      )}

      <AlertModal
        isOpen={confirmarEmision}
        onClose={() => setConfirmarEmision(false)}
        onConfirm={() => emitir.mutate()}
        loading={emitir.isPending}
        title='Emitir Factura de Exportación (DTE 110)'
        description='Se timbrará el documento tributario vía LibreDTE (folio real ante el SII). Guarda tus cambios antes de emitir. Esta acción no se puede deshacer.'
      />
    </div>
  )
}
