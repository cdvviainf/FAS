'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Icons } from '@/components/icons'
import { usePuedeEscribir } from '@/hooks/use-item-acceso'
import { articulosService } from '../../articulos/service'
import { recetasService } from '../service'
import type { Receta } from '../types'
import { RecetaFormSheet } from './receta-form-sheet'

const ITEM = 'operaciones.materiales'

export function RecetaListingClient() {
  const puedeEscribir = usePuedeEscribir(ITEM)
  const [embalajeId, setEmbalajeId] = useState<number | null>(null)
  const [editItem, setEditItem] = useState<Receta | undefined>()
  const [formOpen, setFormOpen] = useState(false)

  const { data: embalajes } = useQuery({
    queryKey: ['embalajes-options'],
    queryFn: () => articulosService.list({ tipo: 'EMBALAJE', activo: true, limit: 500 }),
    staleTime: 60_000,
  })

  const { data: recetas, isPending } = useQuery({
    queryKey: ['recetas-de-embalaje', embalajeId],
    queryFn: () => recetasService.listPorEmbalaje(embalajeId!),
    enabled: !!embalajeId,
  })

  return (
    <div className='space-y-4'>
      <div className='max-w-sm space-y-1.5'>
        <Label>Embalaje</Label>
        <Select value={embalajeId ? String(embalajeId) : ''} onValueChange={(v) => setEmbalajeId(parseInt(v))}>
          <SelectTrigger><SelectValue placeholder='Selecciona un embalaje...' /></SelectTrigger>
          <SelectContent>
            {(embalajes?.data ?? []).map((e) => (
              <SelectItem key={e.id} value={String(e.id)}>{e.codigo} — {e.descripcion}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {embalajeId && (
        <>
          {puedeEscribir && (
            <Button onClick={() => { setEditItem(undefined); setFormOpen(true) }}>
              <Icons.add className='mr-2 h-4 w-4' /> Nueva Receta
            </Button>
          )}

          {isPending ? (
            <p className='text-sm text-muted-foreground'>Cargando...</p>
          ) : (recetas?.data ?? []).length === 0 ? (
            <p className='text-sm text-muted-foreground'>Este embalaje no tiene recetas.</p>
          ) : (
            <div className='space-y-3'>
              {recetas!.data.map((r) => (
                <div key={r.id} className='rounded-md border p-3'>
                  <div className='flex items-center justify-between'>
                    <p className='font-medium'>{r.codigo} — {r.descripcion}</p>
                    {puedeEscribir && (
                      <Button variant='ghost' size='icon' className='h-8 w-8' onClick={() => { setEditItem(r); setFormOpen(true) }}>
                        <Icons.edit className='h-4 w-4' />
                      </Button>
                    )}
                  </div>
                  <p className='text-xs text-muted-foreground'>Produce {r.cantidadAProducir} unidades</p>
                  <ul className='ml-4 mt-1 list-disc text-sm'>
                    {r.detalle.map((d) => (
                      <li key={d.id}>{d.componente.codigo} — {d.componente.descripcion}: {d.cantidadAConsumir}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          <RecetaFormSheet
            embalajeId={embalajeId}
            item={editItem}
            open={formOpen}
            onOpenChange={(v) => { setFormOpen(v); if (!v) setEditItem(undefined) }}
            onSaved={() => {}}
          />
        </>
      )}
    </div>
  )
}
