'use client'

import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Icons } from '@/components/icons'
import { MultiCombobox } from '@/components/shared/multi-combobox'
import { usePuedeEscribir } from '@/hooks/use-item-acceso'
import { embarquesService } from '../service'
import { embarquesKeys, embarquePalletsDisponiblesOptions } from '../queries'
import { estaDespachado } from '../types'
import type { EmbarqueDetalle, PalletResumen } from '../types'

const ITEM = 'VENTAS_EMBARQUES'

// Antigüedad de una línea = fecha de embalaje (compras.md §4.10); cae a la
// fecha de creación del Pallet en PalletLinea históricas sin fechaEmbalaje.
// La antigüedad del Pallet completo es la MAYOR entre sus líneas (decisión
// de negocio) — un pallet no puede ser "más nuevo" que su línea más vieja.
function diasAntiguedad(fechaIso: string, referencia: Date = new Date()): number {
  return Math.round((referencia.getTime() - new Date(fechaIso).getTime()) / 86_400_000)
}

function antiguedadPalletDias(pallet: PalletResumen): number {
  const dias = pallet.lineas.map((l) => diasAntiguedad(l.fechaEmbalaje ?? pallet.creadoEn))
  return dias.length > 0 ? Math.max(...dias) : diasAntiguedad(pallet.creadoEn)
}

// Calificación = Nota Calidad + Nota Condición en una sola celda (ej. "A1",
// "B4") — ambas a nivel de Pallet (compras.md §4.8).
function calificacion(pallet: PalletResumen): string {
  const c = `${pallet.notaCalidad?.codigo ?? ''}${pallet.notaCondicion?.codigo ?? ''}`
  return c || '—'
}

// Un pallet siempre tiene una única especie en la práctica (todas sus líneas
// comparten especie, compras.md §4.8) — se toma de la primera línea.
function especiePallet(pallet: PalletResumen): string {
  return pallet.lineas[0]?.especie.descripcion ?? '—'
}

function cajasTotales(pallet: PalletResumen): number {
  return pallet.lineas.reduce((acc, l) => acc + l.cajas, 0)
}

function kilosTotales(pallet: PalletResumen): number {
  return pallet.lineas.reduce((acc, l) => acc + l.cajas * (l.articulo.kgNetoEnvase != null ? Number(l.articulo.kgNetoEnvase) : 0), 0)
}

// Variedad/Categoría/Calibre agrupados — Especie y cantidad de cajas ya
// salieron a columnas propias (Especie, Cajas), no se repiten acá.
function resumenLineas(pallet: PalletResumen): string {
  const grupos = new Map<string, string>()
  pallet.lineas.forEach((l) => {
    const key = `${l.variedadId}-${l.categoriaId}-${l.calibreId}`
    grupos.set(key, `${l.variedad.descripcion} ${l.categoria.descripcion} ${l.calibre.descripcion}`)
  })
  return [...grupos.values()].join(' · ')
}

function ordenarPorAntiguedad(pallets: PalletResumen[]): PalletResumen[] {
  // Por defecto: de la más antigua a la más nueva (más días primero).
  return pallets.slice().sort((a, b) => antiguedadPalletDias(b) - antiguedadPalletDias(a))
}

interface Filtros {
  plantaIds: string[]
  calificaciones: string[]
  especieIds: string[]
}

const FILTROS_VACIOS: Filtros = { plantaIds: [], calificaciones: [], especieIds: [] }

const FACETS: {
  key: keyof Filtros
  label: string
  getValue: (p: PalletResumen) => string
  getLabel: (p: PalletResumen) => string
}[] = [
  { key: 'plantaIds', label: 'Planta', getValue: (p) => String(p.recepcion.planta.id), getLabel: (p) => p.recepcion.planta.descripcion },
  { key: 'calificaciones', label: 'Calificación', getValue: calificacion, getLabel: calificacion },
  { key: 'especieIds', label: 'Especie', getValue: (p) => String(p.lineas[0]?.especieId ?? ''), getLabel: especiePallet },
]

function coincide(pallet: PalletResumen, filtros: Filtros, exclude?: keyof Filtros): boolean {
  for (const facet of FACETS) {
    if (facet.key === exclude) continue
    const sel = filtros[facet.key]
    if (sel.length === 0) continue
    if (!sel.includes(facet.getValue(pallet))) return false
  }
  return true
}

export function SeleccionarPalletsTab({ embarque }: { embarque: EmbarqueDetalle }) {
  const puedeEscribir = usePuedeEscribir(ITEM)
  const queryClient = useQueryClient()
  const [seleccionados, setSeleccionados] = useState<Set<number>>(new Set())
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_VACIOS)

  const { data: disponiblesData, isLoading } = useQuery(embarquePalletsDisponiblesOptions(embarque.id))
  const disponibles = useMemo(() => disponiblesData?.data ?? [], [disponiblesData])
  const disponiblesFiltrados = useMemo(
    () => ordenarPorAntiguedad(disponibles.filter((p) => coincide(p, filtros))),
    [disponibles, filtros],
  )
  const reservadosOrdenados = useMemo(() => ordenarPorAntiguedad(embarque.pallets), [embarque.pallets])
  const yaDespachado = estaDespachado(embarque)

  function invalidar() {
    queryClient.invalidateQueries({ queryKey: embarquesKeys.detail(embarque.id) })
    queryClient.invalidateQueries({ queryKey: embarquesKeys.palletsDisponibles(embarque.id) })
  }

  const agregarMutation = useMutation({
    mutationFn: () => embarquesService.agregarPallets(embarque.id, [...seleccionados]),
    onSuccess: () => {
      toast.success('Pallets agregados al Embarque')
      setSeleccionados(new Set())
      invalidar()
    },
    onError: (e: Error) => toast.error(e.message || 'Error al agregar los pallets'),
  })

  const quitarMutation = useMutation({
    mutationFn: (palletId: number) => embarquesService.quitarPallet(embarque.id, palletId),
    onSuccess: () => {
      toast.success('Pallet desvinculado')
      invalidar()
    },
    onError: (e: Error) => toast.error(e.message || 'Error al desvincular el pallet'),
  })

  function toggle(id: number) {
    setSeleccionados((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className='space-y-6'>
      <section className='space-y-2'>
        <div className='flex items-center justify-between'>
          <h3 className='text-sm font-semibold'>Pallets reservados a este Embarque</h3>
          <span className='text-muted-foreground text-xs'>{embarque.pallets.length} pallets</span>
        </div>
        <div className='overflow-x-auto rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>N° Pallet</TableHead>
                <TableHead>Calificación</TableHead>
                <TableHead>Planta</TableHead>
                <TableHead>Especie</TableHead>
                <TableHead>Antigüedad</TableHead>
                <TableHead className='text-right'>Cajas</TableHead>
                <TableHead className='text-right'>Kilos</TableHead>
                <TableHead>Productor</TableHead>
                <TableHead>Detalle</TableHead>
                <TableHead className='w-10'></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {embarque.pallets.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className='text-muted-foreground text-center'>
                    Sin pallets reservados todavía.
                  </TableCell>
                </TableRow>
              )}
              {reservadosOrdenados.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{p.numeroPallet}</TableCell>
                  <TableCell>{calificacion(p)}</TableCell>
                  <TableCell>{p.recepcion.planta.descripcion}</TableCell>
                  <TableCell>{especiePallet(p)}</TableCell>
                  <TableCell>
                    <Badge variant='outline'>{antiguedadPalletDias(p)} d</Badge>
                  </TableCell>
                  <TableCell className='text-right tabular-nums'>{cajasTotales(p).toLocaleString('es-CL')}</TableCell>
                  <TableCell className='text-right tabular-nums'>{Math.round(kilosTotales(p)).toLocaleString('es-CL')}</TableCell>
                  <TableCell>{p.productor.descripcion}</TableCell>
                  <TableCell className='text-muted-foreground text-xs'>{resumenLineas(p)}</TableCell>
                  <TableCell>
                    {puedeEscribir && !yaDespachado && (
                      <Button
                        type='button'
                        variant='ghost'
                        size='icon'
                        className='h-7 w-7'
                        onClick={() => quitarMutation.mutate(p.id)}
                        disabled={quitarMutation.isPending}
                      >
                        <Icons.close className='h-4 w-4' />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      {puedeEscribir && (
        <section className='space-y-2'>
          <div className='flex items-center justify-between'>
            <h3 className='text-sm font-semibold'>Pallets disponibles (calzan con el Cierre Comercial)</h3>
            <Button
              type='button'
              size='sm'
              onClick={() => agregarMutation.mutate()}
              disabled={seleccionados.size === 0 || agregarMutation.isPending}
              isLoading={agregarMutation.isPending}
            >
              Agregar seleccionados ({seleccionados.size})
            </Button>
          </div>

          <div className='flex flex-wrap items-end gap-3 rounded-md border p-3'>
            {FACETS.map((facet) => {
              // Catálogo de opciones sale de TODO `disponibles` (no de
              // disponiblesFiltrados) — mismo criterio que Consulta de Stock:
              // una opción sin resultados bajo los demás filtros activos
              // queda deshabilitada (contador en 0), no desaparece.
              const scoped = disponibles.filter((p) => coincide(p, filtros, facet.key))
              const counts = new Map<string, number>()
              scoped.forEach((p) => {
                const v = facet.getValue(p)
                counts.set(v, (counts.get(v) ?? 0) + 1)
              })
              const labels = new Map<string, string>()
              disponibles.forEach((p) => {
                const v = facet.getValue(p)
                if (!labels.has(v)) labels.set(v, facet.getLabel(p))
              })
              const options = [...labels.entries()]
                .map(([value, label]) => ({ value, label, count: counts.get(value) ?? 0 }))
                .sort((a, b) => a.label.localeCompare(b.label))
              return (
                <div key={facet.key} className='min-w-[160px] flex-1 space-y-1'>
                  <Label className='text-[10.5px] tracking-wide uppercase'>{facet.label}</Label>
                  <MultiCombobox
                    options={options}
                    selected={filtros[facet.key]}
                    onChange={(values) => setFiltros((f) => ({ ...f, [facet.key]: values }))}
                    countSuffix='pallets'
                    className='h-8'
                  />
                </div>
              )
            })}
            <Button type='button' variant='ghost' size='sm' onClick={() => setFiltros(FILTROS_VACIOS)}>
              <Icons.close className='mr-2 h-4 w-4' /> Limpiar filtros
            </Button>
          </div>

          {isLoading ? (
            <p className='text-muted-foreground text-sm'>Cargando...</p>
          ) : (
            <div className='overflow-x-auto rounded-md border'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className='w-10'></TableHead>
                    <TableHead>N° Pallet</TableHead>
                    <TableHead>Calificación</TableHead>
                    <TableHead>Planta</TableHead>
                    <TableHead>Especie</TableHead>
                    <TableHead>Antigüedad</TableHead>
                    <TableHead className='text-right'>Cajas</TableHead>
                    <TableHead className='text-right'>Kilos</TableHead>
                    <TableHead>Productor</TableHead>
                    <TableHead>Detalle</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {disponiblesFiltrados.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={10} className='text-muted-foreground text-center'>
                        Sin pallets disponibles que calcen con este Cierre Comercial.
                      </TableCell>
                    </TableRow>
                  )}
                  {disponiblesFiltrados.map((p) => (
                    <TableRow key={p.id} className='cursor-pointer' onClick={() => toggle(p.id)}>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={seleccionados.has(p.id)} onCheckedChange={() => toggle(p.id)} />
                      </TableCell>
                      <TableCell>{p.numeroPallet}</TableCell>
                      <TableCell>{calificacion(p)}</TableCell>
                      <TableCell>{p.recepcion.planta.descripcion}</TableCell>
                      <TableCell>{especiePallet(p)}</TableCell>
                      <TableCell>
                        <Badge variant='outline'>{antiguedadPalletDias(p)} d</Badge>
                      </TableCell>
                      <TableCell className='text-right tabular-nums'>{cajasTotales(p).toLocaleString('es-CL')}</TableCell>
                      <TableCell className='text-right tabular-nums'>{Math.round(kilosTotales(p)).toLocaleString('es-CL')}</TableCell>
                      <TableCell>{p.productor.descripcion}</TableCell>
                      <TableCell className='text-muted-foreground text-xs'>{resumenLineas(p)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
