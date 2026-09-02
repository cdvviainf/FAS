'use client'

import { Fragment, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Icons } from '@/components/icons'
import { MultiCombobox } from '@/components/shared/multi-combobox'
import { usePuedeEscribir } from '@/hooks/use-item-acceso'
import { notasCalidadService } from '@/features/notas-calidad/service'
import { notasCondicionService } from '@/features/notas-condicion/service'
import { gestionPalletsService } from '../service'
import { ESTADO_STOCK_LABELS, diasAntiguedad, bucketAntiguedad } from '@/features/reportes/stock-fruta/types'
import type { AntiguedadBucket } from '@/features/reportes/stock-fruta/types'
import type { StockDetalleRow } from '../types'

const ITEM = 'OPERACIONES_GESTION_PALLETS'
const SIN_NOTA = '__SIN_NOTA__'
const NINGUNA = '__NINGUNA__'

interface Filters {
  especieIds: string[]
  variedadIds: string[]
  calibreIds: string[]
  categoriaIds: string[]
  estados: string[]
  productorIds: string[]
  notaCalidadIds: string[]
  notaCondicionIds: string[]
  completos: string[]
}

const FILTROS_VACIOS: Filters = {
  especieIds: [], variedadIds: [], calibreIds: [], categoriaIds: [], estados: [], productorIds: [],
  notaCalidadIds: [], notaCondicionIds: [], completos: [],
}

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
  { key: 'notaCalidadIds', label: 'Nota Calidad', getValue: (r) => r.notaCalidadId != null ? String(r.notaCalidadId) : SIN_NOTA, getLabel: (r) => r.notaCalidad?.descripcion ?? 'Sin nota' },
  { key: 'notaCondicionIds', label: 'Nota Condición', getValue: (r) => r.notaCondicionId != null ? String(r.notaCondicionId) : SIN_NOTA, getLabel: (r) => r.notaCondicion?.descripcion ?? 'Sin nota' },
  { key: 'completos', label: 'Completo', getValue: (r) => String(r.completo), getLabel: (r) => r.completo ? 'Sí' : 'No' },
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

function groupKey(row: StockDetalleRow): string {
  return `${row.especieId}-${row.variedadId}-${row.calibreId}-${row.categoriaId}`
}

export function GestionPalletsClient() {
  const puedeEscribir = usePuedeEscribir(ITEM)
  const queryClient = useQueryClient()
  const [filters, setFilters] = useState<Filters>(FILTROS_VACIOS)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  const { data, isLoading } = useQuery({
    queryKey: ['gestion-pallets'],
    queryFn: () => gestionPalletsService.list(),
    staleTime: 30_000,
  })
  const rows = useMemo(() => data?.data ?? [], [data])
  const filteredRows = useMemo(() => rows.filter((r) => matches(r, filters)), [rows, filters])

  // Especie "del pallet" para restringir el selector de Nota Calidad/Condición
  // (compras.md §4.8: se asume 1 especie por pallet, y si llegara a mezclar,
  // se usa la especie de su primera línea) — derivada del dataset completo
  // (no de `filteredRows`, para no depender de qué filtros están activos), no
  // de la especie de la fila que se está pintando en cada momento.
  const especieDelPallet = useMemo(() => {
    const map = new Map<number, number>()
    for (const row of rows) {
      if (!map.has(row.palletId)) map.set(row.palletId, row.especieId)
    }
    return map
  }, [rows])

  const { data: notasCalidad } = useQuery({
    queryKey: ['notas-calidad'],
    queryFn: () => notasCalidadService.list(),
    staleTime: 60_000,
  })
  const { data: notasCondicion } = useQuery({
    queryKey: ['notas-condicion'],
    queryFn: () => notasCondicionService.list(),
    staleTime: 60_000,
  })

  const updateMutation = useMutation({
    mutationFn: ({ palletId, data: body }: { palletId: number; data: { notaCalidadId?: number | null; notaCondicionId?: number | null; completo?: boolean } }) =>
      gestionPalletsService.update(palletId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gestion-pallets'] })
      queryClient.invalidateQueries({ queryKey: ['stock-fruta'] })
      toast.success('Pallet actualizado')
    },
    onError: (e: Error) => toast.error(e.message || 'Error al actualizar el pallet'),
  })

  function toggleGroup(key: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // Excluye notas bloqueadas de las opciones de una NUEVA asignación (no
  // aparecen en el selector para elegir), pero si el valor ya asignado a
  // este pallet es justo una nota que se bloqueó después, se reincorpora
  // para que el Select pueda seguir mostrando su etiqueta como valor
  // histórico — nunca se fuerza a "—" solo porque la nota se bloqueó.
  function notasCalidadValidas(especieId: number, valorActual: number | null) {
    const validas = (notasCalidad?.data ?? []).filter((n) => n.especies.some((e) => e.especieId === especieId))
    const disponibles = validas.filter((n) => !n.bloqueado)
    if (valorActual != null && !disponibles.some((n) => n.id === valorActual)) {
      const actual = (notasCalidad?.data ?? []).find((n) => n.id === valorActual)
      if (actual) return [...disponibles, actual]
    }
    return disponibles
  }
  function notasCondicionValidas(especieId: number, valorActual: number | null) {
    const validas = (notasCondicion?.data ?? []).filter((n) => n.especies.some((e) => e.especieId === especieId))
    const disponibles = validas.filter((n) => !n.bloqueado)
    if (valorActual != null && !disponibles.some((n) => n.id === valorActual)) {
      const actual = (notasCondicion?.data ?? []).find((n) => n.id === valorActual)
      if (actual) return [...disponibles, actual]
    }
    return disponibles
  }

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
    return <p className='text-muted-foreground py-10 text-center text-sm'>Cargando pallets...</p>
  }

  // Nota Calidad/Condición/Completo son atributos del Pallet completo, no de
  // cada línea — un mismo pallet puede aparecer en varias filas (distintas
  // líneas, incluso en grupos distintos). Este Set se reconstruye en cada
  // render y se muta mientras se arma el JSX de abajo: solo la PRIMERA fila
  // en la que aparece un `palletId` recibe los controles editables; el resto
  // muestra el valor ya guardado como texto, para no repetir el mismo campo
  // editable varias veces (QAS-PCN-002).
  const renderedPalletIds = new Set<number>()

  return (
    <div className='space-y-6'>
      {/* Filtros */}
      <Card className='py-3'>
        <CardContent className='flex flex-wrap items-end gap-3'>
          {FACETS.map((facet) => {
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
            Pallets — Especie, Variedad, Calibre y Categoría
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
                <TableHead>Nota Calidad</TableHead>
                <TableHead>Nota Condición</TableHead>
                <TableHead>Completo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {grupos.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className='text-muted-foreground text-center'>Sin pallets para estos filtros.</TableCell>
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
                      <TableCell></TableCell>
                      <TableCell></TableCell>
                      <TableCell></TableCell>
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
                          <TableCell className='text-muted-foreground text-[10px] tracking-wide uppercase'>Nota Calidad</TableCell>
                          <TableCell className='text-muted-foreground text-[10px] tracking-wide uppercase'>Nota Condición</TableCell>
                          <TableCell className='text-muted-foreground text-[10px] tracking-wide uppercase'>Completo</TableCell>
                        </TableRow>
                        {g.rows
                          .slice()
                          .sort((a, b) => b.cajas - a.cajas)
                          .map((row) => {
                            const dias = diasAntiguedad(row.fechaRecepcion)
                            const bucket = bucketAntiguedad(dias)
                            const disabled = !puedeEscribir || updateMutation.isPending
                            // Solo la primera fila donde aparece este pallet
                            // (en toda la tabla, no solo en este grupo) edita
                            // sus 3 campos — el resto los muestra de solo
                            // lectura, para no repetir el mismo control del
                            // Pallet varias veces (QAS-PCN-002).
                            const esPrimeraFilaDelPallet = !renderedPalletIds.has(row.palletId)
                            renderedPalletIds.add(row.palletId)
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
                                {esPrimeraFilaDelPallet ? (
                                  <>
                                    <TableCell>
                                      <Select
                                        value={row.notaCalidadId != null ? String(row.notaCalidadId) : NINGUNA}
                                        disabled={disabled}
                                        onValueChange={(v) => updateMutation.mutate({
                                          palletId: row.palletId,
                                          data: { notaCalidadId: v === NINGUNA ? null : Number(v) },
                                        })}
                                      >
                                        <SelectTrigger className='h-8 w-28'><SelectValue placeholder='—' /></SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value={NINGUNA}>—</SelectItem>
                                          {notasCalidadValidas(especieDelPallet.get(row.palletId) ?? row.especieId, row.notaCalidadId).map((n) => (
                                            <SelectItem key={n.id} value={String(n.id)}>{n.descripcion}</SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </TableCell>
                                    <TableCell>
                                      <Select
                                        value={row.notaCondicionId != null ? String(row.notaCondicionId) : NINGUNA}
                                        disabled={disabled}
                                        onValueChange={(v) => updateMutation.mutate({
                                          palletId: row.palletId,
                                          data: { notaCondicionId: v === NINGUNA ? null : Number(v) },
                                        })}
                                      >
                                        <SelectTrigger className='h-8 w-28'><SelectValue placeholder='—' /></SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value={NINGUNA}>—</SelectItem>
                                          {notasCondicionValidas(especieDelPallet.get(row.palletId) ?? row.especieId, row.notaCondicionId).map((n) => (
                                            <SelectItem key={n.id} value={String(n.id)}>{n.descripcion}</SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </TableCell>
                                    <TableCell>
                                      <Switch
                                        checked={row.completo}
                                        disabled={disabled}
                                        onCheckedChange={(checked) => updateMutation.mutate({
                                          palletId: row.palletId,
                                          data: { completo: checked },
                                        })}
                                      />
                                    </TableCell>
                                  </>
                                ) : (
                                  <>
                                    <TableCell className='text-muted-foreground'>{row.notaCalidad?.descripcion ?? '—'}</TableCell>
                                    <TableCell className='text-muted-foreground'>{row.notaCondicion?.descripcion ?? '—'}</TableCell>
                                    <TableCell>
                                      <Badge variant={row.completo ? 'default' : 'secondary'}>{row.completo ? 'Sí' : 'No'}</Badge>
                                    </TableCell>
                                  </>
                                )}
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
