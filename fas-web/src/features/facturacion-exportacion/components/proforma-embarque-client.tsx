'use client'

import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Icons } from '@/components/icons'
import { formatMonto } from '@/lib/format'
import { usePuedeEscribir } from '@/hooks/use-item-acceso'
import { proformaPorEmbarqueOptions, proformasKeys } from '../queries'
import { abrirCierreComercial, hoyFecha, proformaService } from '../service'
import { DIMENSION_LABELS } from '../types'
import type { DimensionProforma, ProformaLineaSugerida } from '../types'
import { ProformaDetalleView } from './proforma-detalle-view'

const ITEM = 'FACT_EXPORTACION'
const TODAS_LAS_DIMENSIONES: DimensionProforma[] = ['VARIEDAD', 'ARTICULO', 'CALIBRE', 'CATEGORIA', 'MARCA']

export function ProformaEmbarqueClient({ embarqueId }: { embarqueId: number }) {
  const { data, isPending } = useQuery(proformaPorEmbarqueOptions(embarqueId))

  if (isPending) return <p className='text-muted-foreground text-sm'>Cargando...</p>

  return data?.data ? <ProformaDetalleView proforma={data.data} /> : <EmitirProformaForm embarqueId={embarqueId} />
}

function EmitirProformaForm({ embarqueId }: { embarqueId: number }) {
  const queryClient = useQueryClient()
  const puedeEscribir = usePuedeEscribir(ITEM)
  const [dimensiones, setDimensiones] = useState<DimensionProforma[]>([])
  const [idioma, setIdioma] = useState<'EN' | 'ES'>('EN')
  const [fechaDocumento, setFechaDocumento] = useState<string>(hoyFecha())
  const [lineas, setLineas] = useState<ProformaLineaSugerida[]>([])
  const [montoFlete, setMontoFlete] = useState<string>('')
  const [montoSeguro, setMontoSeguro] = useState<string>('')
  const [observaciones, setObservaciones] = useState<string>('')

  const { data: sugerencia, isPending: cargandoSugerencia } = useQuery({
    queryKey: ['proforma-sugerencia', embarqueId, dimensiones],
    queryFn: () => proformaService.sugerirLineas(embarqueId, dimensiones),
    enabled: embarqueId > 0,
  })

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLineas(sugerencia?.data ?? [])
  }, [sugerencia])

  const clausula = sugerencia?.clausula ?? null
  const requiereFlete = clausula?.requiereFlete ?? false
  const requiereSeguro = clausula?.requiereSeguro ?? false
  const faltantesExtranjera = sugerencia?.faltantesExtranjera ?? []
  const notaVentaId = sugerencia?.notaVentaId ?? null
  const enBloqueadoPorFaltantes = idioma === 'EN' && faltantesExtranjera.length > 0

  function toggleDimension(dim: DimensionProforma, marcado: boolean) {
    setDimensiones((prev) => (marcado ? [...prev, dim] : prev.filter((d) => d !== dim)))
  }

  function actualizarLinea(index: number, cambios: Partial<ProformaLineaSugerida>) {
    setLineas((prev) =>
      prev.map((l, i) => {
        if (i !== index) return l
        const actualizada = { ...l, ...cambios }
        // El usuario edita el precio unitario; el monto de línea se deriva.
        actualizada.montoLinea = Math.round(actualizada.precioUnitario * actualizada.cantidadCajas * 100) / 100
        return actualizada
      }),
    )
  }

  const montoTotal = lineas.reduce((acc, l) => acc + l.montoLinea, 0)
  const fleteNum = requiereFlete ? Number(montoFlete) || 0 : 0
  const seguroNum = requiereSeguro ? Number(montoSeguro) || 0 : 0
  const subtotalFob = Math.round((montoTotal - fleteNum - seguroNum) * 100) / 100

  const emitir = useMutation({
    mutationFn: () =>
      proformaService.emitir(embarqueId, {
        dimensiones,
        idioma,
        fechaDocumento: fechaDocumento || null,
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
        observaciones: observaciones.trim() || null,
      }),
    onSuccess: () => {
      toast.success('Proforma emitida')
      queryClient.invalidateQueries({ queryKey: proformasKeys.porEmbarque(embarqueId) })
      queryClient.invalidateQueries({ queryKey: proformasKeys.all })
    },
    onError: (e: Error) => toast.error(e.message || 'Error al emitir la Proforma'),
  })

  function handleEmitir() {
    if (lineas.length === 0) {
      toast.error('No hay líneas para emitir — este Embarque no tiene pallets con fruta')
      return
    }
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
    if (enBloqueadoPorFaltantes) {
      toast.error(`No se puede emitir en inglés: faltan descripciones extranjeras (${faltantesExtranjera.join(' · ')})`)
      return
    }
    if (!fechaDocumento) {
      toast.error('La fecha del documento es obligatoria')
      return
    }
    emitir.mutate()
  }

  return (
    <div className='max-w-3xl space-y-4'>
      <h2 className='text-xl font-semibold'>Emitir Proforma</h2>

      <Card>
        <CardHeader><CardTitle className='text-sm'>Agrupación de líneas</CardTitle></CardHeader>
        <CardContent className='space-y-3'>
          <p className='text-muted-foreground text-xs'>
            Especie siempre se factura por separado. Marca qué más quieres desglosar en cada línea.
          </p>
          <div className='flex flex-wrap gap-4'>
            {TODAS_LAS_DIMENSIONES.map((dim) => (
              <label key={dim} className='flex items-center gap-2 text-sm'>
                <Checkbox checked={dimensiones.includes(dim)} onCheckedChange={(c) => toggleDimension(dim, !!c)} />
                {DIMENSION_LABELS[dim]}
              </label>
            ))}
          </div>
          <div className='flex flex-wrap items-end gap-4'>
            <div className='w-[180px] space-y-1.5'>
              <Label>Idioma del PDF</Label>
              <Select value={idioma} onValueChange={(v) => setIdioma(v as 'EN' | 'ES')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value='EN'>Inglés</SelectItem>
                  <SelectItem value='ES'>Español</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className='w-[180px] space-y-1.5'>
              <Label>Fecha del documento</Label>
              <Input type='date' value={fechaDocumento} onChange={(e) => setFechaDocumento(e.target.value)} className='h-9' />
            </div>
            {notaVentaId != null && (
              <Button variant='outline' size='sm' onClick={() => abrirCierreComercial(notaVentaId)}>
                <Icons.externalLink className='mr-2 h-4 w-4' /> Ver Cierre Comercial
              </Button>
            )}
          </div>
          <div className='space-y-1.5'>
            <Label>Observaciones</Label>
            <Textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              rows={3}
              maxLength={100}
              placeholder='Observaciones libres del documento (máx. 100 caracteres, se muestran en el PDF)'
            />
          </div>
          {enBloqueadoPorFaltantes && (
            <p className='text-xs text-destructive'>
              No se puede emitir en inglés: falta la descripción extranjera de — {faltantesExtranjera.join(' · ')}.
              Complétala en el mantenedor o usa español.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className='text-sm'>Líneas sugeridas</CardTitle></CardHeader>
        <CardContent>
          {cargandoSugerencia ? (
            <p className='text-muted-foreground text-sm'>Calculando...</p>
          ) : lineas.length === 0 ? (
            <p className='text-muted-foreground rounded-md border border-dashed p-6 text-center text-sm'>
              Este Embarque no tiene pallets con fruta.
            </p>
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
                    {/* Descripción derivada de los mantenedores según idioma
                        (se arma en el PDF); no es texto libre. */}
                    <TableCell className='text-sm'>{l.descripcion}</TableCell>
                    <TableCell className='text-right tabular-nums'>{formatMonto(l.cantidadCajas, 0)}</TableCell>
                    <TableCell>
                      <Input
                        type='number'
                        min={0}
                        step='0.0001'
                        value={l.precioUnitario}
                        onChange={(e) => actualizarLinea(i, { precioUnitario: Number(e.target.value) })}
                        className='h-8 text-right'
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
                  <TableCell className='text-right tabular-nums'>{formatMonto(montoTotal)}</TableCell>
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
              valor FOB de la mercadería. El total y las cuotas siguen sobre el valor de la cláusula.
            </p>
            <div className='flex flex-wrap gap-4'>
              {requiereFlete && (
                <div className='space-y-1.5'>
                  <Label>Flete *</Label>
                  <Input
                    type='number'
                    min={0}
                    step='0.01'
                    value={montoFlete}
                    onChange={(e) => setMontoFlete(e.target.value)}
                    className='h-8 w-40 text-right'
                  />
                </div>
              )}
              {requiereSeguro && (
                <div className='space-y-1.5'>
                  <Label>Seguro *</Label>
                  <Input
                    type='number'
                    min={0}
                    step='0.01'
                    value={montoSeguro}
                    onChange={(e) => setMontoSeguro(e.target.value)}
                    className='h-8 w-40 text-right'
                  />
                </div>
              )}
            </div>
            <div className='space-y-1 border-t pt-2 text-sm tabular-nums'>
              <div className='flex justify-between'>
                <span className='text-muted-foreground'>Valor FOB (mercadería)</span>
                <span>{formatMonto(subtotalFob)}</span>
              </div>
              {requiereFlete && (
                <div className='flex justify-between'>
                  <span className='text-muted-foreground'>Flete</span>
                  <span>{formatMonto(fleteNum)}</span>
                </div>
              )}
              {requiereSeguro && (
                <div className='flex justify-between'>
                  <span className='text-muted-foreground'>Seguro</span>
                  <span>{formatMonto(seguroNum)}</span>
                </div>
              )}
              <div className='flex justify-between font-semibold'>
                <span>Total (valor cláusula)</span>
                <span>{formatMonto(montoTotal)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {puedeEscribir && (
        <Button onClick={handleEmitir} isLoading={emitir.isPending} disabled={lineas.length === 0}>
          <Icons.check className='mr-2 h-4 w-4' /> Emitir Proforma
        </Button>
      )}
    </div>
  )
}
