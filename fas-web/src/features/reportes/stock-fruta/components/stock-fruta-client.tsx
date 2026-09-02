'use client'

import { Fragment, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Bar, BarChart, XAxis } from 'recharts'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Icons } from '@/components/icons'
import { MultiCombobox } from '@/components/shared/multi-combobox'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { stockFrutaService } from '../service'
import { ESTADO_STOCK_LABELS, ANTIGUEDAD_LABELS, diasAntiguedad, bucketAntiguedad } from '../types'
import type { StockDetalleRow, AntiguedadBucket } from '../types'

interface Filters {
  especieIds: string[]
  variedadIds: string[]
  calibreIds: string[]
  categoriaIds: string[]
  estados: string[]
  productorIds: string[]
}

const FILTROS_VACIOS: Filters = {
  especieIds: [], variedadIds: [], calibreIds: [], categoriaIds: [], estados: [], productorIds: [],
}

// Orden fijado por el usuario: Especie, Variedad, Calibre, Categoría, Estado, Productor.
const FACETS: {
  key: keyof Filters
  label: string
  getValue: (row: StockDetalleRow) => string
  getLabel: (row: StockDetalleRow) => string
}[] = [
  { key: 'especieIds', label: 'Especie', getValue: (r) => String(r.especieId), getLabel: (r) => r.especie.descripcion },
  { key: 'variedadIds', label: 'Variedad', getValue: (r) => String(r.variedadId), getLabel: (r) => r.variedad.descripcion },
  { key: 'calibreIds', label: 'Calibre', getValue: (r) => String(r.calibreId), getLabel: (r) => r.calibre.descripcion },
  { key: 'categoriaIds', label: 'Categoría', getValue: (r) => String(r.categoriaId), getLabel: (r) => r.categoria.descripcion },
  { key: 'estados', label: 'Estado', getValue: (r) => r.estado, getLabel: (r) => ESTADO_STOCK_LABELS[r.estado] },
  { key: 'productorIds', label: 'Productor', getValue: (r) => String(r.productorId), getLabel: (r) => r.productor.descripcion },
]

function matches(row: StockDetalleRow, filters: Filters, exclude?: keyof Filters): boolean {
  for (const facet of FACETS) {
    if (facet.key === exclude) continue
    const sel = filters[facet.key]
    if (sel.length === 0) continue
    if (!sel.includes(facet.getValue(row))) return false
  }
  return true
}

const AGING_BADGE_VARIANT: Record<AntiguedadBucket, string> = {
  fresh: 'border-emerald-600/30 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400',
  mid: 'border-amber-600/30 bg-amber-600/10 text-amber-700 dark:text-amber-400',
  old: 'border-red-600/30 bg-red-600/10 text-red-700 dark:text-red-400',
}
const AGING_BAR_COLOR: Record<AntiguedadBucket, string> = { fresh: 'bg-emerald-500', mid: 'bg-amber-500', old: 'bg-red-500' }

// Serie única (cajas por calibre) — un solo hue, sin leyenda (dataviz: job =
// magnitud por categoría, no identidad entre series).
const CALIBRE_CHART_CONFIG = {
  cajas: { label: 'Cajas', color: 'var(--chart-1)' },
} satisfies ChartConfig

function groupKey(row: StockDetalleRow): string {
  return `${row.especieId}-${row.variedadId}-${row.calibreId}-${row.categoriaId}`
}

export function StockFrutaClient() {
  const [filters, setFilters] = useState<Filters>(FILTROS_VACIOS)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  const { data, isLoading } = useQuery({
    queryKey: ['stock-fruta'],
    queryFn: () => stockFrutaService.list(),
    staleTime: 30_000,
  })
  const rows = useMemo(() => data?.data ?? [], [data])
  const filteredRows = useMemo(() => rows.filter((r) => matches(r, filters)), [rows, filters]);

  function toggleGroup(key: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // ---- Tarjetas por especie (cajas, kilos, apertura por antigüedad) ----
  const especieCards = useMemo(() => {
    const groups = new Map<number, {
      especieId: number; nombre: string; cajas: number; kg: number
      fresh: number; mid: number; old: number; pallets: Set<number>
      calibres: Map<number, { orden: number; label: string; cajas: number }>
    }>()
    filteredRows.forEach((row) => {
      let g = groups.get(row.especieId)
      if (!g) {
        g = { especieId: row.especieId, nombre: row.especie.descripcion, cajas: 0, kg: 0, fresh: 0, mid: 0, old: 0, pallets: new Set(), calibres: new Map() }
        groups.set(row.especieId, g)
      }
      g.cajas += row.cajas
      g.kg += row.kg
      g[bucketAntiguedad(diasAntiguedad(row.fechaRecepcion))] += row.cajas
      g.pallets.add(row.palletId)
      const c = g.calibres.get(row.calibreId) ?? { orden: row.calibre.orden, label: row.calibre.descripcion, cajas: 0 }
      c.cajas += row.cajas
      g.calibres.set(row.calibreId, c)
    })
    return [...groups.values()]
      .sort((a, b) => b.cajas - a.cajas)
      .map((g) => ({
        ...g,
        // Eje X en el orden real del maestro de Calibres (por especie), no alfabético.
        calibresChart: [...g.calibres.values()].sort((a, b) => a.orden - b.orden),
      }))
  }, [filteredRows])

  const totalCajas = filteredRows.reduce((acc, r) => acc + r.cajas, 0)
  const totalKg = filteredRows.reduce((acc, r) => acc + r.kg, 0)

  // ---- Grilla: grupo Especie/Variedad/Calibre/Categoría -> detalle por pallet ----
  const grupos = useMemo(() => {
    const map = new Map<string, {
      key: string; especie: string; variedad: string; calibre: string; categoria: string
      cajas: number; kg: number; rows: StockDetalleRow[]
    }>()
    filteredRows.forEach((row) => {
      const key = groupKey(row)
      let g = map.get(key)
      if (!g) {
        g = { key, especie: row.especie.descripcion, variedad: row.variedad.descripcion, calibre: row.calibre.descripcion,
          categoria: row.categoria.descripcion, cajas: 0, kg: 0, rows: [] }
        map.set(key, g)
      }
      g.cajas += row.cajas
      g.kg += row.kg
      g.rows.push(row)
    })
    return [...map.values()].sort((a, b) =>
      a.especie.localeCompare(b.especie) || a.variedad.localeCompare(b.variedad))
  }, [filteredRows])

  if (isLoading) {
    return <p className='text-muted-foreground py-10 text-center text-sm'>Cargando stock...</p>
  }

  return (
    <div className='space-y-6'>
      {/* Tarjetas por especie */}
      <section className='space-y-3'>
        <div className='flex items-baseline justify-between'>
          <h2 className='text-muted-foreground text-xs font-semibold tracking-wide uppercase'>Stock por especie</h2>
          <p className='text-muted-foreground text-xs tabular-nums'>
            {especieCards.length} especie{especieCards.length === 1 ? '' : 's'} · {totalCajas.toLocaleString('es-CL')} cajas · {Math.round(totalKg).toLocaleString('es-CL')} kg
          </p>
        </div>
        {especieCards.length === 0 ? (
          <p className='text-muted-foreground rounded-md border border-dashed p-8 text-center text-sm'>Sin stock para estos filtros.</p>
        ) : (
          <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
            {especieCards.map((g) => {
              const pct = (n: number) => (g.cajas ? (n / g.cajas) * 100 : 0)
              return (
                <button
                  key={g.especieId}
                  type='button'
                  onClick={() =>
                    setFilters((f) => {
                      const id = String(g.especieId)
                      const has = f.especieIds.includes(id)
                      return { ...f, especieIds: has ? f.especieIds.filter((v) => v !== id) : [...f.especieIds, id] }
                    })
                  }
                  className={`rounded-lg border p-4 text-left transition-colors hover:border-primary/50 ${filters.especieIds.includes(String(g.especieId)) ? 'border-primary ring-1 ring-primary' : ''}`}
                >
                  <div className='flex items-start justify-between gap-2'>
                    <h3 className='font-serif text-base font-semibold'>{g.nombre}</h3>
                    <span className='text-muted-foreground text-[11px] whitespace-nowrap tabular-nums'>{g.pallets.size} pallets</span>
                  </div>
                  <div className='mt-2 flex gap-5'>
                    <div>
                      <div className='text-2xl font-bold tabular-nums'>{g.cajas.toLocaleString('es-CL')}</div>
                      <div className='text-muted-foreground text-[10px] tracking-wide uppercase'>Cajas</div>
                    </div>
                    <div>
                      <div className='text-2xl font-bold tabular-nums'>{Math.round(g.kg).toLocaleString('es-CL')}</div>
                      <div className='text-muted-foreground text-[10px] tracking-wide uppercase'>Kilos</div>
                    </div>
                  </div>
                  <div className='mt-3'>
                    <div className='flex h-1.5 overflow-hidden rounded-full bg-muted'>
                      <div className={AGING_BAR_COLOR.fresh} style={{ width: `${pct(g.fresh)}%` }} />
                      <div className={AGING_BAR_COLOR.mid} style={{ width: `${pct(g.mid)}%` }} />
                      <div className={AGING_BAR_COLOR.old} style={{ width: `${pct(g.old)}%` }} />
                    </div>
                    <div className='text-muted-foreground mt-1.5 flex flex-wrap gap-x-2.5 gap-y-0.5 text-[10.5px]'>
                      <span>{ANTIGUEDAD_LABELS.fresh}: {g.fresh.toLocaleString('es-CL')}</span>
                      <span>{ANTIGUEDAD_LABELS.mid}: {g.mid.toLocaleString('es-CL')}</span>
                      <span>{ANTIGUEDAD_LABELS.old}: {g.old.toLocaleString('es-CL')}</span>
                    </div>
                  </div>
                  {g.calibresChart.length > 0 && (
                    <div className='mt-3'>
                      <p className='text-muted-foreground mb-1 text-[10px] tracking-wide uppercase'>Distribución por calibre</p>
                      <ChartContainer config={CALIBRE_CHART_CONFIG} className='aspect-auto h-16 w-full'>
                        <BarChart data={g.calibresChart} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                          <XAxis
                            dataKey='label'
                            tickLine={false}
                            axisLine={false}
                            interval={0}
                            tick={{ fontSize: 9 }}
                          />
                          <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                          <Bar dataKey='cajas' fill='var(--color-cajas)' radius={2} />
                        </BarChart>
                      </ChartContainer>
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </section>

      {/* Filtros */}
      <Card className='py-3'>
        <CardContent className='flex flex-wrap items-end gap-3'>
          {FACETS.map((facet) => {
            // El catálogo de opciones sale de TODO el dataset (rows), no solo
            // de `scoped` — si no, una opción sin cajas bajo los demás
            // filtros activos desaparecería en vez de quedar deshabilitada
            // (QAS-STK-005, QA ronda 2). Los contadores sí salen de `scoped`.
            const scoped = rows.filter((r) => matches(r, filters, facet.key))
            const counts = new Map<string, number>()
            scoped.forEach((row) => {
              const v = facet.getValue(row)
              counts.set(v, (counts.get(v) ?? 0) + row.cajas)
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
                  countSuffix='caj.'
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

      {/* Grilla de detalle */}
      <section className='space-y-3'>
        <div className='flex items-baseline justify-between'>
          <h2 className='text-muted-foreground text-xs font-semibold tracking-wide uppercase'>
            Detalle por especie, variedad, calibre y categoría
          </h2>
          <div className='flex gap-2 text-xs'>
            <button type='button' className='text-primary hover:underline' onClick={() => setExpandedGroups(new Set(grupos.map((g) => g.key)))}>
              Expandir todo
            </button>
            <span className='text-muted-foreground'>·</span>
            <button type='button' className='text-primary hover:underline' onClick={() => setExpandedGroups(new Set())}>
              Contraer todo
            </button>
          </div>
        </div>
        <div className='overflow-x-auto rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className='w-8'></TableHead>
                <TableHead>Especie</TableHead>
                <TableHead>Variedad</TableHead>
                <TableHead>Calibre</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead className='text-right'>Cajas</TableHead>
                <TableHead className='text-right'>Kilos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {grupos.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className='text-muted-foreground text-center'>Sin combinaciones para estos filtros.</TableCell>
                </TableRow>
              )}
              {grupos.map((g) => {
                const isOpen = expandedGroups.has(g.key)
                return (
                  <Fragment key={g.key}>
                    <TableRow className='bg-muted/40 hover:bg-muted/60 cursor-pointer font-medium' onClick={() => toggleGroup(g.key)}>
                      <TableCell>{isOpen ? <Icons.chevronDown className='h-4 w-4' /> : <Icons.chevronRight className='h-4 w-4' />}</TableCell>
                      <TableCell>{g.especie}</TableCell>
                      <TableCell>{g.variedad}</TableCell>
                      <TableCell>{g.calibre}</TableCell>
                      <TableCell>{g.categoria}</TableCell>
                      <TableCell className='text-right tabular-nums'>{g.cajas.toLocaleString('es-CL')}</TableCell>
                      <TableCell className='text-right tabular-nums'>{Math.round(g.kg).toLocaleString('es-CL')}</TableCell>
                    </TableRow>
                    {isOpen && (
                      <>
                        <TableRow className='bg-muted/20 hover:bg-muted/20'>
                          <TableCell></TableCell>
                          <TableCell className='text-muted-foreground text-[10px] tracking-wide uppercase'>Folio</TableCell>
                          <TableCell className='text-muted-foreground text-[10px] tracking-wide uppercase'>Productor</TableCell>
                          <TableCell className='text-muted-foreground text-[10px] tracking-wide uppercase'>Antigüedad</TableCell>
                          <TableCell className='text-muted-foreground text-[10px] tracking-wide uppercase'>Estado</TableCell>
                          <TableCell className='text-muted-foreground text-right text-[10px] tracking-wide uppercase'>Cajas</TableCell>
                          <TableCell className='text-muted-foreground text-right text-[10px] tracking-wide uppercase'>Kilos</TableCell>
                        </TableRow>
                        {g.rows
                          .slice()
                          .sort((a, b) => b.cajas - a.cajas)
                          .map((row) => {
                            const dias = diasAntiguedad(row.fechaRecepcion)
                            const bucket = bucketAntiguedad(dias)
                            return (
                              <TableRow key={row.palletLineaId}>
                                <TableCell></TableCell>
                                <TableCell className='text-muted-foreground'>{row.numeroPallet}</TableCell>
                                <TableCell>{row.productor.descripcion}</TableCell>
                                <TableCell>
                                  <Badge variant='outline' className={AGING_BADGE_VARIANT[bucket]}>{dias} d</Badge>
                                </TableCell>
                                <TableCell>
                                  <Badge variant={row.estado === 'VALIDADA' ? 'default' : 'secondary'}>{ESTADO_STOCK_LABELS[row.estado]}</Badge>
                                </TableCell>
                                <TableCell className='text-muted-foreground text-right tabular-nums'>{row.cajas.toLocaleString('es-CL')}</TableCell>
                                <TableCell className='text-muted-foreground text-right tabular-nums'>{Math.round(row.kg).toLocaleString('es-CL')}</TableCell>
                              </TableRow>
                            )
                          })}
                      </>
                    )}
                  </Fragment>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  )
}
