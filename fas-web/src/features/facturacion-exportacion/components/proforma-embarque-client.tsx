'use client'

import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Icons } from '@/components/icons'
import { formatMonto } from '@/lib/format'
import { usePuedeEscribir } from '@/hooks/use-item-acceso'
import { proformaPorEmbarqueOptions, proformasKeys } from '../queries'
import { proformaService } from '../service'
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
  const [lineas, setLineas] = useState<ProformaLineaSugerida[]>([])

  const { data: sugerencia, isPending: cargandoSugerencia } = useQuery({
    queryKey: ['proforma-sugerencia', embarqueId, dimensiones],
    queryFn: () => proformaService.sugerirLineas(embarqueId, dimensiones),
    enabled: embarqueId > 0,
  })

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLineas(sugerencia?.data ?? [])
  }, [sugerencia])

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

  const emitir = useMutation({
    mutationFn: () =>
      proformaService.emitir(embarqueId, {
        dimensiones,
        idioma,
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
          <div className='max-w-[200px] space-y-1.5'>
            <Label>Idioma del PDF</Label>
            <Select value={idioma} onValueChange={(v) => setIdioma(v as 'EN' | 'ES')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value='EN'>Inglés</SelectItem>
                <SelectItem value='ES'>Español</SelectItem>
              </SelectContent>
            </Select>
          </div>
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
                    <TableCell>
                      <Input
                        value={l.descripcion}
                        onChange={(e) => actualizarLinea(i, { descripcion: e.target.value })}
                        className='h-8'
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

      {puedeEscribir && (
        <Button onClick={handleEmitir} isLoading={emitir.isPending} disabled={lineas.length === 0}>
          <Icons.check className='mr-2 h-4 w-4' /> Emitir Proforma
        </Button>
      )}
    </div>
  )
}
