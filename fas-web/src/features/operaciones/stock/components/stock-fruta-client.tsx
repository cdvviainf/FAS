'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Combobox } from '@/components/ui/combobox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Icons } from '@/components/icons'
import { createMantenedorService } from '@/features/mantenedor-simple/service'
import { entidadesService } from '@/features/entidades/service'
import { formatFechaCorta } from '@/lib/format'
import { stockFrutaService } from '../service'
import { ORIGEN_STOCK_LABELS } from '../types'
import type { StockFiltros, StockResumenItem, OrigenStock } from '../types'

const especiesService = createMantenedorService('especies')
const variedadesService = createMantenedorService('variedades')
const categoriasService = createMantenedorService('categorias')
const calibresService = createMantenedorService('calibres')

const FILTROS_VACIOS: StockFiltros = {}

export function StockFrutaClient() {
  const [filtros, setFiltros] = useState<StockFiltros>(FILTROS_VACIOS)
  const [detalleSeleccionado, setDetalleSeleccionado] = useState<StockResumenItem | null>(null)

  const { data: productoresData } = useQuery({
    queryKey: ['productores-options-stock'],
    queryFn: () => entidadesService.list({ tipo: 'PRODUCTOR', limit: 500, activo: true }),
    staleTime: 5 * 60_000,
  })
  const { data: especiesData } = useQuery({
    queryKey: ['especies-options-stock'],
    queryFn: () => especiesService.list({ limit: 200 }),
    staleTime: 5 * 60_000,
  })
  const { data: variedadesData } = useQuery({
    queryKey: ['variedades-options-stock', filtros.especieId],
    queryFn: () => variedadesService.list({ limit: 200, especieId: filtros.especieId }),
    staleTime: 60_000,
    enabled: !!filtros.especieId,
  })
  const { data: categoriasData } = useQuery({
    queryKey: ['categorias-options-stock', filtros.especieId],
    queryFn: () => categoriasService.list({ limit: 200, especieId: filtros.especieId }),
    staleTime: 60_000,
    enabled: !!filtros.especieId,
  })
  const { data: calibresData } = useQuery({
    queryKey: ['calibres-options-stock', filtros.especieId],
    queryFn: () => calibresService.list({ limit: 200, especieId: filtros.especieId }),
    staleTime: 60_000,
    enabled: !!filtros.especieId,
  })

  const { data: resumenData, isLoading } = useQuery({
    queryKey: ['stock-fruta-resumen', filtros],
    queryFn: () => stockFrutaService.getResumen(filtros),
    staleTime: 30_000,
  })

  const { data: detalleData, isLoading: isLoadingDetalle } = useQuery({
    queryKey: [
      'stock-fruta-detalle',
      filtros,
      detalleSeleccionado?.especieId,
      detalleSeleccionado?.variedadId,
      detalleSeleccionado?.categoriaId,
      detalleSeleccionado?.calibreId,
    ],
    queryFn: () =>
      stockFrutaService.getDetalle({
        ...filtros,
        especieId: detalleSeleccionado!.especieId,
        variedadId: detalleSeleccionado!.variedadId,
        categoriaId: detalleSeleccionado!.categoriaId,
        calibreId: detalleSeleccionado!.calibreId,
      }),
    enabled: !!detalleSeleccionado,
  })

  const resumen = resumenData?.data ?? []
  const totalCajas = resumen.reduce((acc, r) => acc + r.cajas, 0)
  const totalPallets = resumen.reduce((acc, r) => acc + r.pallets, 0)

  function actualizarEspecie(especieId: number | undefined) {
    // Cambiar (o limpiar) la especie invalida variedad/categoría/calibre —
    // esos combos dependen de ella (mismo patrón que el form de OC).
    setFiltros((f) => ({ ...f, especieId, variedadId: undefined, categoriaId: undefined, calibreId: undefined }))
  }

  return (
    <div className='space-y-6'>
      <Card>
        <CardContent className='space-y-4 pt-6'>
          <div className='grid gap-3 sm:grid-cols-2 md:grid-cols-4'>
            <div className='space-y-1.5'>
              <Label>Productor</Label>
              <Combobox
                value={filtros.productorId ? String(filtros.productorId) : ''}
                onChange={(v) => setFiltros((f) => ({ ...f, productorId: v ? Number(v) : undefined }))}
                placeholder='Todos los productores'
                searchPlaceholder='Buscar productor...'
                options={[
                  { value: '', label: 'Todos los productores' },
                  ...(productoresData?.data ?? []).map((p) => ({ value: String(p.id), label: `${p.descripcion} — ${p.razonSocial}` })),
                ]}
              />
            </div>
            <div className='space-y-1.5'>
              <Label>Especie</Label>
              <Select
                value={filtros.especieId ? String(filtros.especieId) : '__all__'}
                onValueChange={(v) => actualizarEspecie(v === '__all__' ? undefined : Number(v))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value='__all__'>Todas</SelectItem>
                  {(especiesData?.data ?? []).map((e) => (
                    <SelectItem key={e.id} value={String(e.id)}>{e.descripcion}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className='space-y-1.5'>
              <Label>Variedad</Label>
              <Select
                value={filtros.variedadId ? String(filtros.variedadId) : '__all__'}
                onValueChange={(v) => setFiltros((f) => ({ ...f, variedadId: v === '__all__' ? undefined : Number(v) }))}
                disabled={!filtros.especieId}
              >
                <SelectTrigger><SelectValue placeholder={filtros.especieId ? undefined : 'Elige una especie primero'} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value='__all__'>Todas</SelectItem>
                  {(variedadesData?.data ?? []).map((v) => (
                    <SelectItem key={v.id} value={String(v.id)}>{v.descripcion}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className='space-y-1.5'>
              <Label>Categoría</Label>
              <Select
                value={filtros.categoriaId ? String(filtros.categoriaId) : '__all__'}
                onValueChange={(v) => setFiltros((f) => ({ ...f, categoriaId: v === '__all__' ? undefined : Number(v) }))}
                disabled={!filtros.especieId}
              >
                <SelectTrigger><SelectValue placeholder={filtros.especieId ? undefined : 'Elige una especie primero'} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value='__all__'>Todas</SelectItem>
                  {(categoriasData?.data ?? []).map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.descripcion}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className='grid gap-3 sm:grid-cols-2 md:grid-cols-4'>
            <div className='space-y-1.5'>
              <Label>Calibre</Label>
              <Select
                value={filtros.calibreId ? String(filtros.calibreId) : '__all__'}
                onValueChange={(v) => setFiltros((f) => ({ ...f, calibreId: v === '__all__' ? undefined : Number(v) }))}
                disabled={!filtros.especieId}
              >
                <SelectTrigger><SelectValue placeholder={filtros.especieId ? undefined : 'Elige una especie primero'} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value='__all__'>Todas</SelectItem>
                  {(calibresData?.data ?? []).map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.descripcion}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className='space-y-1.5'>
              <Label>Origen</Label>
              <Select
                value={filtros.origen ?? '__all__'}
                onValueChange={(v) => setFiltros((f) => ({ ...f, origen: v === '__all__' ? undefined : (v as OrigenStock) }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value='__all__'>Todos</SelectItem>
                  {(Object.keys(ORIGEN_STOCK_LABELS) as OrigenStock[]).map((o) => (
                    <SelectItem key={o} value={o}>{ORIGEN_STOCK_LABELS[o]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className='space-y-1.5'>
              <Label>Recepción desde</Label>
              <Input
                type='date'
                value={filtros.fechaDesde ?? ''}
                onChange={(e) => setFiltros((f) => ({ ...f, fechaDesde: e.target.value || undefined }))}
              />
            </div>
            <div className='space-y-1.5'>
              <Label>Recepción hasta</Label>
              <Input
                type='date'
                value={filtros.fechaHasta ?? ''}
                onChange={(e) => setFiltros((f) => ({ ...f, fechaHasta: e.target.value || undefined }))}
              />
            </div>
          </div>
          <div className='flex justify-end'>
            <Button type='button' variant='ghost' onClick={() => setFiltros(FILTROS_VACIOS)}>
              <Icons.close className='mr-2 h-4 w-4' /> Limpiar filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className='pt-6'>
          <p className='mb-3 text-sm text-muted-foreground'>
            {resumen.length} combinación{resumen.length === 1 ? '' : 'es'} · {totalCajas.toLocaleString('es-CL')} cajas · {totalPallets.toLocaleString('es-CL')} pallets
          </p>
          <div className='overflow-x-auto rounded-md border'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Especie / Variedad</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Calibre</TableHead>
                  <TableHead className='text-right'>Cajas</TableHead>
                  <TableHead className='text-right'>Pallets</TableHead>
                  <TableHead className='w-28 text-right'>Detalle</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={6} className='text-center text-muted-foreground'>Cargando...</TableCell>
                  </TableRow>
                )}
                {!isLoading && resumen.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className='text-center text-muted-foreground'>Sin stock para estos filtros.</TableCell>
                  </TableRow>
                )}
                {resumen.map((r) => (
                  <TableRow key={`${r.especieId}-${r.variedadId}-${r.categoriaId}-${r.calibreId}`}>
                    <TableCell className='font-medium whitespace-nowrap'>{r.especie.descripcion} / {r.variedad.descripcion}</TableCell>
                    <TableCell className='whitespace-nowrap text-muted-foreground'>{r.categoria.descripcion}</TableCell>
                    <TableCell className='whitespace-nowrap text-muted-foreground'>{r.calibre.codigo}</TableCell>
                    <TableCell className='text-right'>{r.cajas.toLocaleString('es-CL')}</TableCell>
                    <TableCell className='text-right'>{r.pallets.toLocaleString('es-CL')}</TableCell>
                    <TableCell className='text-right'>
                      <Button type='button' variant='outline' size='sm' onClick={() => setDetalleSeleccionado(r)}>
                        Ver pallets
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!detalleSeleccionado} onOpenChange={(open) => !open && setDetalleSeleccionado(null)}>
        <DialogContent className='sm:max-w-2xl'>
          <DialogHeader>
            <DialogTitle>
              {detalleSeleccionado &&
                `${detalleSeleccionado.especie.descripcion} / ${detalleSeleccionado.variedad.descripcion} — ${detalleSeleccionado.categoria.descripcion} / ${detalleSeleccionado.calibre.codigo}`}
            </DialogTitle>
            <DialogDescription>Pallets que componen esta combinación (con los filtros activos aplicados).</DialogDescription>
          </DialogHeader>
          <div className='max-h-[60vh] overflow-y-auto rounded-md border'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N° Pallet</TableHead>
                  <TableHead>Productor</TableHead>
                  <TableHead>Origen</TableHead>
                  <TableHead>Recepción</TableHead>
                  <TableHead className='text-right'>Cajas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingDetalle && (
                  <TableRow>
                    <TableCell colSpan={5} className='text-center text-muted-foreground'>Cargando...</TableCell>
                  </TableRow>
                )}
                {(detalleData?.data ?? []).map((d) => (
                  <TableRow key={d.palletLineaId}>
                    <TableCell className='font-medium'>{d.numeroPallet}</TableCell>
                    <TableCell>{d.productor.descripcion}</TableCell>
                    <TableCell><Badge variant='outline'>{ORIGEN_STOCK_LABELS[d.origen]}</Badge></TableCell>
                    <TableCell>{formatFechaCorta(d.creadoEn)}</TableCell>
                    <TableCell className='text-right'>{d.cajas.toLocaleString('es-CL')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
