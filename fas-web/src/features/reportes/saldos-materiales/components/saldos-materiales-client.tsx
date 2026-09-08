'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Icons } from '@/components/icons'
import { MultiCombobox } from '@/components/shared/multi-combobox'
import { TIPO_ARTICULO_LABELS } from '@/features/materiales/articulos/types'
import { saldosMaterialesService } from '../service'
import type { SaldoMaterialRow } from '../types'

// Mismo shell de filtros por facetas que Stock de Fruta (stock-fruta-client.tsx)
// pero sin las tarjetas/gráficos por especie de arriba — acá el grano ya es
// el más fino (Artículo x Bodega, sin nada que expandir), así que "el
// detalle" es directamente la grilla plana.

interface Filters {
  bodegaIds: string[]
  tipos: string[]
  bajoCritico: string[]
}

const FILTROS_VACIOS: Filters = { bodegaIds: [], tipos: [], bajoCritico: [] }

const BAJO_CRITICO_LABELS: Record<'si' | 'no', string> = { si: 'Bajo crítico', no: 'Normal' }

function esBajoCritico(row: SaldoMaterialRow): boolean {
  return row.articulo.stockCritico != null && row.cantidad < row.articulo.stockCritico
}

const FACETS: {
  key: keyof Filters
  label: string
  getValue: (row: SaldoMaterialRow) => string
  getLabel: (row: SaldoMaterialRow) => string
}[] = [
  { key: 'bodegaIds', label: 'Bodega', getValue: (r) => String(r.bodegaId), getLabel: (r) => r.bodega.descripcion },
  { key: 'tipos', label: 'Tipo', getValue: (r) => r.articulo.tipo, getLabel: (r) => TIPO_ARTICULO_LABELS[r.articulo.tipo] },
  { key: 'bajoCritico', label: 'Estado', getValue: (r) => (esBajoCritico(r) ? 'si' : 'no'), getLabel: (r) => BAJO_CRITICO_LABELS[esBajoCritico(r) ? 'si' : 'no'] },
]

function matches(row: SaldoMaterialRow, filters: Filters, exclude?: keyof Filters): boolean {
  for (const facet of FACETS) {
    if (facet.key === exclude) continue
    const sel = filters[facet.key]
    if (sel.length === 0) continue
    if (!sel.includes(facet.getValue(row))) return false
  }
  return true
}

export function SaldosMaterialesClient() {
  const [filters, setFilters] = useState<Filters>(FILTROS_VACIOS)

  const { data, isLoading } = useQuery({
    queryKey: ['saldos-materiales'],
    queryFn: () => saldosMaterialesService.list(),
    staleTime: 30_000,
  })
  const rows = useMemo(() => data?.data ?? [], [data])
  const filteredRows = useMemo(
    () =>
      rows
        .filter((r) => matches(r, filters))
        .sort((a, b) => a.articulo.codigo.localeCompare(b.articulo.codigo) || a.bodega.descripcion.localeCompare(b.bodega.descripcion)),
    [rows, filters],
  )

  const totalArticulos = new Set(filteredRows.map((r) => r.articuloId)).size
  const totalBodegas = new Set(filteredRows.map((r) => r.bodegaId)).size

  if (isLoading) {
    return <p className='text-muted-foreground py-10 text-center text-sm'>Cargando stock...</p>
  }

  return (
    <div className='space-y-6'>
      {/* Filtros */}
      <Card className='py-3'>
        <CardContent className='flex flex-wrap items-end gap-3'>
          {FACETS.map((facet) => {
            // Catálogo de opciones desde TODO el dataset (no solo `scoped`) —
            // mismo motivo que stock-fruta: una opción sin registros bajo los
            // demás filtros activos queda deshabilitada, no desaparece.
            const scoped = rows.filter((r) => matches(r, filters, facet.key))
            const counts = new Map<string, number>()
            scoped.forEach((row) => {
              const v = facet.getValue(row)
              counts.set(v, (counts.get(v) ?? 0) + 1)
            })
            const labels = new Map<string, string>()
            rows.forEach((row) => {
              const v = facet.getValue(row)
              if (!labels.has(v)) labels.set(v, facet.getLabel(row))
            })
            const options = [...labels.entries()]
              .map(([value, label]) => ({ value, label, count: counts.get(value) ?? 0 }))
              .sort((a, b) => a.label.localeCompare(b.label))
            return (
              <div key={facet.key} className='min-w-[160px] flex-1 space-y-1'>
                <Label className='text-[10.5px] tracking-wide uppercase'>{facet.label}</Label>
                <MultiCombobox
                  options={options}
                  selected={filters[facet.key]}
                  onChange={(values) => setFilters((f) => ({ ...f, [facet.key]: values }))}
                  countSuffix='art.'
                  className='h-8'
                />
              </div>
            )
          })}
          <Button type='button' variant='ghost' size='sm' onClick={() => setFilters(FILTROS_VACIOS)}>
            <Icons.close className='mr-2 h-4 w-4' /> Limpiar filtros
          </Button>
        </CardContent>
      </Card>

      {/* Grilla */}
      <section className='space-y-3'>
        <div className='flex items-baseline justify-between'>
          <h2 className='text-muted-foreground text-xs font-semibold tracking-wide uppercase'>Stock por artículo y bodega</h2>
          <p className='text-muted-foreground text-xs tabular-nums'>
            {totalArticulos} artículo{totalArticulos === 1 ? '' : 's'} · {totalBodegas} bodega{totalBodegas === 1 ? '' : 's'} · {filteredRows.length} registro{filteredRows.length === 1 ? '' : 's'}
          </p>
        </div>
        <div className='overflow-x-auto rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Bodega</TableHead>
                <TableHead className='text-right'>Cantidad</TableHead>
                <TableHead>Unidad</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className='text-muted-foreground text-center'>Sin stock para estos filtros.</TableCell>
                </TableRow>
              )}
              {filteredRows.map((row) => {
                const bajoCritico = esBajoCritico(row)
                return (
                  <TableRow key={`${row.articuloId}-${row.bodegaId}`}>
                    <TableCell className='font-medium'>{row.articulo.codigo}</TableCell>
                    <TableCell>{row.articulo.descripcion}</TableCell>
                    <TableCell className='text-muted-foreground'>{TIPO_ARTICULO_LABELS[row.articulo.tipo]}</TableCell>
                    <TableCell className='text-muted-foreground'>{row.bodega.descripcion}</TableCell>
                    <TableCell className='text-right tabular-nums'>{row.cantidad.toLocaleString('es-CL')}</TableCell>
                    <TableCell className='text-muted-foreground'>{row.articulo.unidad.codigo}</TableCell>
                    <TableCell>
                      {bajoCritico ? (
                        <Badge variant='outline' className='border-red-600/30 bg-red-600/10 text-red-700 dark:text-red-400'>Bajo crítico</Badge>
                      ) : (
                        <Badge variant='secondary'>Normal</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  )
}
