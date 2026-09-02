'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Icons } from '@/components/icons'
import { AlertModal } from '@/components/modal/alert-modal'
import { usePuedeEscribir } from '@/hooks/use-item-acceso'
import { notasCalidadService } from '../service'
import type { NotaCalidad } from '../types'
import { NotaCalidadFormSheet } from './nota-calidad-form-sheet'

const ITEM = 'CONFIG_MANTENEDORES'

export function NotaCalidadListingClient() {
  const puedeEscribir = usePuedeEscribir(ITEM)
  const queryClient = useQueryClient()
  const [editItem, setEditItem] = useState<NotaCalidad | undefined>()
  const [formOpen, setFormOpen] = useState(false)
  const [deleteItem, setDeleteItem] = useState<NotaCalidad | undefined>()

  const { data, isPending } = useQuery({
    queryKey: ['notas-calidad'],
    queryFn: () => notasCalidadService.list(),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => notasCalidadService.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notas-calidad'] })
      toast.success('Nota de Calidad eliminada')
      setDeleteItem(undefined)
    },
    onError: (e: Error) => toast.error(e.message || 'Error al eliminar la Nota de Calidad'),
  })

  if (isPending) return <p className='text-sm text-muted-foreground'>Cargando...</p>

  return (
    <div className='space-y-3'>
      {(data?.data ?? []).length === 0 ? (
        <p className='text-sm text-muted-foreground'>No hay Notas de Calidad creadas.</p>
      ) : (
        <div className='space-y-2'>
          {data!.data.map((n) => (
            <div key={n.id} className='rounded-md border p-3'>
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-2'>
                  <p className='font-medium'>{n.codigo} — {n.descripcion}</p>
                  {n.bloqueado && <Badge variant='secondary'>Bloqueado</Badge>}
                </div>
                {puedeEscribir && (
                  <div className='flex gap-1'>
                    <Button variant='ghost' size='icon' className='h-8 w-8' onClick={() => { setEditItem(n); setFormOpen(true) }}>
                      <Icons.edit className='h-4 w-4' />
                    </Button>
                    <Button variant='ghost' size='icon' className='h-8 w-8' onClick={() => setDeleteItem(n)}>
                      <Icons.trash className='h-4 w-4' />
                    </Button>
                  </div>
                )}
              </div>
              {n.especies.length > 0 && (
                <div className='mt-2 flex flex-wrap gap-1'>
                  {n.especies.map((e) => (
                    <Badge key={e.id} variant='outline'>{e.especie.descripcion}</Badge>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <NotaCalidadFormSheet
        item={editItem}
        open={formOpen}
        onOpenChange={(v) => { setFormOpen(v); if (!v) setEditItem(undefined) }}
      />
      <AlertModal
        isOpen={!!deleteItem}
        onClose={() => setDeleteItem(undefined)}
        onConfirm={() => deleteItem && deleteMutation.mutate(deleteItem.id)}
        loading={deleteMutation.isPending}
        title='Eliminar Nota de Calidad'
        description='¿Eliminar esta Nota de Calidad?'
      />
    </div>
  )
}
