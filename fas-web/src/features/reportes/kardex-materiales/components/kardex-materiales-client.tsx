'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Icons } from '@/components/icons'
import { MultiCombobox } from '@/components/shared/multi-combobox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createMantenedorService } from '@/features/mantenedor-simple/service'
import { articulosService } from '@/features/materiales/articulos/service'
import { kardexMaterialesService } from '../service'
import { CLASE_MOVIMIENTO_LABELS } from '../types'
import type { KardexRow } from '../types'

const bodegasService = createMantenedorService('bodegas')

const fmtFecha = new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium', timeZone: 'America/Santiago' })
const fmtCantidad = (n: number) => n.toLocaleString('es-CL', { maximumFractionDigits: 3 })
const fmtCosto = (n: number) => n.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function bodegaCelda(row: KardexRow) {
  const o = row.bodegaOrigen?.descripcion
  const d = row.bodegaDestino?.descripcion
  if (o && d) return `${o} → ${d}`
  return o ?? d ?? '—'
}

interface KardexPanelProps {
  articuloId: number
  bodegaId?: number
  fechaDesde?: string
  fechaHasta?: string
}

function KardexPanel({ articuloId, bodegaId, fechaDesde, fechaHasta }: KardexPanelProps) {
  const { data, isPending, error } = useQuery({
    queryKey: ['kardex-materiales', articuloId, bodegaId, fechaDesde, fechaHasta],
    queryFn: () => kardexMaterialesService.obtener({ articuloId, bodegaId, fechaDesde, fechaHasta }),
  })

  if (isPending) return <p className='text-muted-foreground text-sm'>Cargando...</p>
  if (error) return <p className='text-destructive text-sm'>{(error as Error).message || 'Error al cargar el Kardex'}</p>

  const kardex = data.data

  return (
    <div className='space-y-3'>
      <div className='grid grid-cols-2 gap-2 sm:grid-cols-4'>
        <div className='rounded-md border p-2'>
          <p className='text-muted-foreground text-xs'>Saldo inicial</p>
          <p className='font-medium'>{fmtCantidad(kardex.saldoInicial.cantidad)}</p>
        </div>
        <div className='rounded-md border p-2'>
          <p className='text-muted-foreground text-xs'>Costo promedio inicial</p>
          <p className='font-medium'>{fmtCosto(kardex.saldoInicial.costoPromedio)}</p>
        </div>
        <div className='rounded-md border p-2'>
          <p className='text-muted-foreground text-xs'>Saldo final</p>
          <p className='font-medium'>{fmtCantidad(kardex.saldoFinal.cantidad)}</p>
        </div>
        <div className='rounded-md border p-2'>
          <p className='text-muted-foreground text-xs'>Valor saldo final</p>
          <p className='font-medium'>{fmtCosto(kardex.saldoFinal.valorizado)}</p>
        </div>
      </div>

      {kardex.rows.length === 0 ? (
        <p className='text-muted-foreground text-sm'>Sin movimientos en el rango consultado.</p>
      ) : (
        <div className='overflow-x-auto rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Bodega</TableHead>
                <TableHead>Entidad</TableHead>
                <TableHead>Guía</TableHead>
                <TableHead className='text-right'>Entrada</TableHead>
                <TableHead className='text-right'>Salida</TableHead>
                <TableHead className='text-right'>Costo Unit.</TableHead>
                <TableHead className='text-right'>Saldo Cant.</TableHead>
                <TableHead className='text-right'>Costo Prom.</TableHead>
                <TableHead className='text-right'>Valor Saldo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {kardex.rows.map((row) => (
                <TableRow key={row.movimientoId}>
                  <TableCell>{fmtFecha.format(new Date(row.fecha))}</TableCell>
                  <TableCell>
                    <Badge variant='outline'>{row.tipoMovimiento.descripcion}</Badge>
                    <span className='text-muted-foreground ml-1 text-xs'>{CLASE_MOVIMIENTO_LABELS[row.clase]}</span>
                  </TableCell>
                  <TableCell>{bodegaCelda(row)}</TableCell>
                  <TableCell>{row.entidad?.descripcion ?? '—'}</TableCell>
                  <TableCell>{row.guiaReferencia ?? '—'}</TableCell>
                  <TableCell className='text-right'>{row.cantidadEntrada > 0 ? fmtCantidad(row.cantidadEntrada) : '—'}</TableCell>
                  <TableCell className='text-right'>{row.cantidadSalida > 0 ? fmtCantidad(row.cantidadSalida) : '—'}</TableCell>
                  <TableCell className='text-right'>{row.costoUnitario != null ? fmtCosto(row.costoUnitario) : '—'}</TableCell>
                  <TableCell className='text-right'>{fmtCantidad(row.saldoCantidad)}</TableCell>
                  <TableCell className='text-right'>{fmtCosto(row.saldoCostoPromedio)}</TableCell>
                  <TableCell className='text-right'>{fmtCosto(row.saldoValorizado)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

export function KardexMaterialesClient() {
  const [articuloIds, setArticuloIds] = useState<string[]>([])
  const [expanded, setExpanded] = useState<string[]>([])
  const [bodegaId, setBodegaId] = useState<string>('')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')

  const { data: articulosDisponibles } = useQuery({
    queryKey: ['articulos-options-kardex'],
    queryFn: () => articulosService.list({ activo: true, limit: 500 }),
    staleTime: 60_000,
  })
  const { data: bodegas } = useQuery({
    queryKey: ['bodegas-options-kardex'],
    queryFn: () => bodegasService.list({ soloActivos: true, limit: 500 }),
    staleTime: 60_000,
  })

  const opcionesArticulo = useMemo(
    () => (articulosDisponibles?.data ?? []).map((a) => ({ value: String(a.id), label: `${a.codigo} — ${a.descripcion}` })),
    [articulosDisponibles],
  )

  function handleArticulosChange(values: string[]) {
    const nuevos = values.filter((v) => !articuloIds.includes(v))
    setArticuloIds(values)
    setExpanded((prev) => [...prev, ...nuevos])
  }

  function quitarArticulo(id: string) {
    setArticuloIds((prev) => prev.filter((v) => v !== id))
    setExpanded((prev) => prev.filter((v) => v !== id))
  }

  function nombreArticulo(id: string) {
    return opcionesArticulo.find((o) => o.value === id)?.label ?? id
  }

  return (
    <div className='space-y-6'>
      <Card>
        <CardContent className='grid gap-4 pt-6 sm:grid-cols-2 lg:grid-cols-4'>
          <div className='space-y-2 lg:col-span-2'>
            <Label>Artículos</Label>
            <MultiCombobox
              options={opcionesArticulo}
              selected={articuloIds}
              onChange={handleArticulosChange}
              placeholder='Seleccionar artículos...'
              searchPlaceholder='Buscar artículo...'
            />
          </div>
          <div className='space-y-2'>
            <Label>Bodega <span className='text-muted-foreground text-xs'>(opcional — consolidado si no se elige)</span></Label>
            <Select value={bodegaId || 'todas'} onValueChange={(v) => setBodegaId(v === 'todas' ? '' : v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value='todas'>Todas (consolidado)</SelectItem>
                {(bodegas?.data ?? []).map((b) => (
                  <SelectItem key={b.id} value={String(b.id)}>{b.descripcion}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className='grid grid-cols-2 gap-2'>
            <div className='space-y-2'>
              <Label>Desde</Label>
              <Input type='date' value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} />
            </div>
            <div className='space-y-2'>
              <Label>Hasta</Label>
              <Input type='date' value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {articuloIds.length === 0 ? (
        <p className='text-muted-foreground text-sm'>Selecciona uno o más artículos para ver su Kardex.</p>
      ) : (
        <Accordion type='multiple' value={expanded} onValueChange={setExpanded}>
          {articuloIds.map((id) => (
            <AccordionItem key={id} value={id}>
              <div className='flex items-center'>
                <AccordionTrigger className='flex-1'>{nombreArticulo(id)}</AccordionTrigger>
                <Button
                  type='button'
                  variant='ghost'
                  size='icon'
                  className='h-8 w-8 shrink-0'
                  onClick={(e) => { e.stopPropagation(); quitarArticulo(id) }}
                >
                  <Icons.trash className='h-4 w-4' />
                </Button>
              </div>
              <AccordionContent>
                <KardexPanel
                  articuloId={Number(id)}
                  bodegaId={bodegaId ? Number(bodegaId) : undefined}
                  fechaDesde={fechaDesde || undefined}
                  fechaHasta={fechaHasta || undefined}
                />
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  )
}
