'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import type { LineaReclamable, PalletReclamable } from '../types'

// Selector dual (reclamos.md §7): la misma selección se puede armar mirando
// "por Pallet" (línea a línea, útil cuando el reclamo apunta a pallets
// puntuales) o "por Características" (agrupado especie/variedad/calibre/
// categoría, útil cuando el reclamo cubre un lote entero sin importar en
// qué pallet físico cayó cada caja) — ambas vistas leen/escriben el mismo
// estado (`value`: palletLineaId -> cantidad marcada), igual que el patrón
// de agrupación de Stock de Fruta.

export type SeleccionLineas = Map<number, number>

interface LineasSelectorProps {
  pallets: PalletReclamable[]
  value: SeleccionLineas
  onChange: (value: SeleccionLineas) => void
}

function groupKey(l: LineaReclamable): string {
  return `${l.especie.id}-${l.variedad.id}-${l.calibre.id}-${l.categoria.id}`
}

export function LineasSelector({ pallets, value, onChange }: LineasSelectorProps) {
  const [vista, setVista] = useState<'pallet' | 'caracteristicas'>('pallet')

  const totalSeleccionado = useMemo(() => [...value.values()].reduce((a, b) => a + b, 0), [value])

  function setCantidad(lineaId: number, cantidad: number, disponible: number) {
    const next = new Map(value)
    const clamped = Math.max(0, Math.min(cantidad, disponible))
    if (clamped === 0) next.delete(lineaId)
    else next.set(lineaId, clamped)
    onChange(next)
  }

  // ─── Vista por características: agrupa todas las líneas de todos los
  // pallets y distribuye la cantidad pedida del grupo entre sus líneas
  // (llena la primera línea disponible, sigue con la siguiente, etc.) ──────
  const grupos = useMemo(() => {
    const map = new Map<string, { key: string; especie: string; variedad: string; calibre: string; categoria: string; lineas: LineaReclamable[] }>()
    pallets.forEach((p) => {
      p.lineas.forEach((l) => {
        const key = groupKey(l)
        let g = map.get(key)
        if (!g) {
          g = { key, especie: l.especie.descripcion, variedad: l.variedad.descripcion, calibre: l.calibre.descripcion, categoria: l.categoria.descripcion, lineas: [] }
          map.set(key, g)
        }
        g.lineas.push(l)
      })
    })
    return [...map.values()].sort((a, b) => a.especie.localeCompare(b.especie))
  }, [pallets])

  function cantidadGrupo(lineas: LineaReclamable[]): number {
    return lineas.reduce((acc, l) => acc + (value.get(l.id) ?? 0), 0)
  }

  function disponibleGrupo(lineas: LineaReclamable[]): number {
    return lineas.reduce((acc, l) => acc + l.cajasDisponibles, 0)
  }

  function setCantidadGrupo(lineas: LineaReclamable[], cantidad: number) {
    const disponible = disponibleGrupo(lineas)
    let restante = Math.max(0, Math.min(cantidad, disponible))
    const next = new Map(value)
    for (const l of lineas) {
      const asignar = Math.min(restante, l.cajasDisponibles)
      if (asignar > 0) next.set(l.id, asignar)
      else next.delete(l.id)
      restante -= asignar
    }
    onChange(next)
  }

  return (
    <div className='space-y-3'>
      <div className='flex items-center justify-between'>
        <div className='flex gap-1'>
          <Button type='button' size='sm' variant={vista === 'pallet' ? 'default' : 'outline'} onClick={() => setVista('pallet')}>
            Por Pallet
          </Button>
          <Button type='button' size='sm' variant={vista === 'caracteristicas' ? 'default' : 'outline'} onClick={() => setVista('caracteristicas')}>
            Por Características
          </Button>
        </div>
        <p className='text-muted-foreground text-xs tabular-nums'>{totalSeleccionado} caja(s) marcada(s)</p>
      </div>

      <div className='max-h-80 overflow-y-auto rounded-md border'>
        {vista === 'pallet' ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pallet</TableHead>
                <TableHead>Especie</TableHead>
                <TableHead>Variedad</TableHead>
                <TableHead>Calibre</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead className='text-right'>Disponible</TableHead>
                <TableHead className='w-28 text-right'>Reclamar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pallets.flatMap((p) =>
                p.lineas.map((l) => (
                  <TableRow key={l.id} className={l.cajasDisponibles === 0 ? 'opacity-50' : ''}>
                    <TableCell className='text-muted-foreground'>{p.numeroPallet}</TableCell>
                    <TableCell>{l.especie.descripcion}</TableCell>
                    <TableCell>{l.variedad.descripcion}</TableCell>
                    <TableCell>{l.calibre.descripcion}</TableCell>
                    <TableCell>{l.categoria.descripcion}</TableCell>
                    <TableCell className='text-right tabular-nums'>{l.cajasDisponibles}</TableCell>
                    <TableCell>
                      <Input
                        type='number'
                        min={0}
                        max={l.cajasDisponibles}
                        disabled={l.cajasDisponibles === 0}
                        value={value.get(l.id) ?? ''}
                        onChange={(e) => setCantidad(l.id, Number(e.target.value), l.cajasDisponibles)}
                        className='h-8 text-right'
                      />
                    </TableCell>
                  </TableRow>
                )),
              )}
              {pallets.every((p) => p.lineas.length === 0) && (
                <TableRow>
                  <TableCell colSpan={7} className='text-muted-foreground text-center'>Este Embarque no tiene pallets con fruta.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Especie</TableHead>
                <TableHead>Variedad</TableHead>
                <TableHead>Calibre</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead className='text-right'>Disponible</TableHead>
                <TableHead className='w-28 text-right'>Reclamar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {grupos.map((g) => {
                const disponible = disponibleGrupo(g.lineas)
                return (
                  <TableRow key={g.key} className={disponible === 0 ? 'opacity-50' : ''}>
                    <TableCell>{g.especie}</TableCell>
                    <TableCell>{g.variedad}</TableCell>
                    <TableCell>{g.calibre}</TableCell>
                    <TableCell>{g.categoria}</TableCell>
                    <TableCell className='text-right tabular-nums'>{disponible}</TableCell>
                    <TableCell>
                      <Input
                        type='number'
                        min={0}
                        max={disponible}
                        disabled={disponible === 0}
                        value={cantidadGrupo(g.lineas) || ''}
                        onChange={(e) => setCantidadGrupo(g.lineas, Number(e.target.value))}
                        className='h-8 text-right'
                      />
                    </TableCell>
                  </TableRow>
                )
              })}
              {grupos.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className='text-muted-foreground text-center'>Este Embarque no tiene pallets con fruta.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>
      {totalSeleccionado === 0 && (
        <Badge variant='outline' className='border-amber-600/30 bg-amber-600/10 text-amber-700 dark:text-amber-400'>
          Selecciona al menos una línea
        </Badge>
      )}
    </div>
  )
}
