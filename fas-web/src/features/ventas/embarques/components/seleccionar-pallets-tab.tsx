'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Icons } from '@/components/icons'
import { usePuedeEscribir } from '@/hooks/use-item-acceso'
import { embarquesService } from '../service'
import { embarquesKeys, embarquePalletsDisponiblesOptions } from '../queries'
import type { EmbarqueDetalle, PalletResumen } from '../types'

const ITEM = 'VENTAS_EMBARQUES'

const ORIGEN_LABELS: Record<PalletResumen['origen'], string> = {
  COMPRA: 'Compra',
  CONSIGNACION: 'Consignación',
  PROCESO: 'Proceso',
}

// De qué OC (modo COMPRA) o de qué Instructivo(s) de Embalaje (modo PROCESO)
// viene el pallet — trazabilidad Cierre Comercial ↔ Embarque ↔ Pallet.
// Consignación es carga libre, sin OC ni Instructivo asociado.
function origenTexto(pallet: PalletResumen): string {
  if (pallet.origen === 'COMPRA') {
    return pallet.recepcion.ordenCompra ? `OC ${pallet.recepcion.ordenCompra.numero}` : '—'
  }
  if (pallet.origen === 'PROCESO') {
    const nums = pallet.recepcion.instructivos.map((i) => `N° ${i.instructivo.numero}`)
    return nums.length > 0 ? nums.join(', ') : '—'
  }
  return '—'
}

function resumenLineas(pallet: PalletResumen): string {
  const grupos = new Map<string, { label: string; cajas: number }>()
  pallet.lineas.forEach((l) => {
    const key = `${l.especieId}-${l.variedadId}-${l.categoriaId}-${l.calibreId}`
    const label = `${l.especie.descripcion} ${l.variedad.descripcion} ${l.categoria.descripcion} ${l.calibre.descripcion}`
    const g = grupos.get(key) ?? { label, cajas: 0 }
    g.cajas += l.cajas
    grupos.set(key, g)
  })
  return [...grupos.values()].map((g) => `${g.label} (${g.cajas} caj.)`).join(' · ')
}

export function SeleccionarPalletsTab({ embarque }: { embarque: EmbarqueDetalle }) {
  const puedeEscribir = usePuedeEscribir(ITEM)
  const queryClient = useQueryClient()
  const [seleccionados, setSeleccionados] = useState<Set<number>>(new Set())

  const { data: disponiblesData, isLoading } = useQuery(embarquePalletsDisponiblesOptions(embarque.id))
  const disponibles = disponiblesData?.data ?? []
  const yaDespachado = !!embarque.despachadoEn

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
                <TableHead>Origen</TableHead>
                <TableHead>Procedencia</TableHead>
                <TableHead>Productor</TableHead>
                <TableHead>Detalle</TableHead>
                <TableHead className='w-10'></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {embarque.pallets.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className='text-muted-foreground text-center'>
                    Sin pallets reservados todavía.
                  </TableCell>
                </TableRow>
              )}
              {embarque.pallets.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{p.numeroPallet}</TableCell>
                  <TableCell>
                    <Badge variant='outline'>{ORIGEN_LABELS[p.origen]}</Badge>
                  </TableCell>
                  <TableCell>{origenTexto(p)}</TableCell>
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
          {isLoading ? (
            <p className='text-muted-foreground text-sm'>Cargando...</p>
          ) : (
            <div className='overflow-x-auto rounded-md border'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className='w-10'></TableHead>
                    <TableHead>N° Pallet</TableHead>
                    <TableHead>Origen</TableHead>
                    <TableHead>Procedencia</TableHead>
                    <TableHead>Productor</TableHead>
                    <TableHead>Detalle</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {disponibles.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className='text-muted-foreground text-center'>
                        Sin pallets disponibles que calcen con este Cierre Comercial.
                      </TableCell>
                    </TableRow>
                  )}
                  {disponibles.map((p) => (
                    <TableRow key={p.id} className='cursor-pointer' onClick={() => toggle(p.id)}>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={seleccionados.has(p.id)} onCheckedChange={() => toggle(p.id)} />
                      </TableCell>
                      <TableCell>{p.numeroPallet}</TableCell>
                      <TableCell>
                        <Badge variant='outline'>{ORIGEN_LABELS[p.origen]}</Badge>
                      </TableCell>
                      <TableCell>{origenTexto(p)}</TableCell>
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
