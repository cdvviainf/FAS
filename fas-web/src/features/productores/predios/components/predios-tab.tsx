'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Icons } from '@/components/icons'
import { AlertModal } from '@/components/modal/alert-modal'
import { usePuedeEscribir } from '@/hooks/use-item-acceso'
import { prediosService } from '../service'
import type { Predio } from '../types'
import { PredioFormSheet } from './predio-form-sheet'

const ITEM = 'productores.ficha'

export function PrediosTab({ entidadId, predios }: { entidadId: number; predios: Predio[] }) {
  const puedeEscribir = usePuedeEscribir(ITEM)
  const queryClient = useQueryClient()
  const [editItem, setEditItem] = useState<Predio | undefined>()
  const [formOpen, setFormOpen] = useState(false)
  const [deleteItem, setDeleteItem] = useState<Predio | undefined>()

  const deleteMutation = useMutation({
    mutationFn: (predioId: number) => prediosService.remove(entidadId, predioId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productores', 'ficha', entidadId] })
      toast.success('Predio eliminado')
      setDeleteItem(undefined)
    },
    onError: (e: Error) => toast.error(e.message || 'Error al eliminar el predio'),
  })

  return (
    <div className='space-y-3'>
      {puedeEscribir && (
        <Button onClick={() => { setEditItem(undefined); setFormOpen(true) }}>
          <Icons.add className='mr-2 h-4 w-4' /> Nuevo Predio
        </Button>
      )}

      {predios.length === 0 ? (
        <p className='text-sm text-muted-foreground'>Este productor no tiene predios registrados.</p>
      ) : (
        <div className='space-y-2'>
          {predios.map((p) => (
            <div key={p.id} className='flex items-center justify-between rounded-md border p-3'>
              <div>
                <p className='font-medium'>{p.codigo} — {p.descripcion}</p>
                <p className='text-xs text-muted-foreground'>
                  {[p.comuna?.descripcion, p.tipoProduccion?.descripcion, p.zona?.descripcion].filter(Boolean).join(' · ') || 'Sin datos adicionales'}
                </p>
              </div>
              {puedeEscribir && (
                <div className='flex gap-1'>
                  <Button variant='ghost' size='icon' className='h-8 w-8' onClick={() => { setEditItem(p); setFormOpen(true) }}>
                    <Icons.edit className='h-4 w-4' />
                  </Button>
                  <Button variant='ghost' size='icon' className='h-8 w-8' onClick={() => setDeleteItem(p)}>
                    <Icons.trash className='h-4 w-4' />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <PredioFormSheet
        entidadId={entidadId}
        item={editItem}
        open={formOpen}
        onOpenChange={(v) => { setFormOpen(v); if (!v) setEditItem(undefined) }}
      />
      <AlertModal
        isOpen={!!deleteItem}
        onClose={() => setDeleteItem(undefined)}
        onConfirm={() => deleteItem && deleteMutation.mutate(deleteItem.id)}
        loading={deleteMutation.isPending}
        title='Eliminar predio'
        description='¿Eliminar este predio del productor?'
      />
    </div>
  )
}
