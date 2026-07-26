'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Icons } from '@/components/icons'
import { AlertModal } from '@/components/modal/alert-modal'
import { usePuedeEscribir } from '@/hooks/use-item-acceso'
import { condicionesPagoService } from '../service'
import type { CondicionPago } from '../types'
import { CondicionPagoFormSheet } from './condicion-pago-form-sheet'

const ITEM = 'CONFIG_MANTENEDORES'

export function CondicionPagoListingClient() {
  const puedeEscribir = usePuedeEscribir(ITEM)
  const queryClient = useQueryClient()
  const [editItem, setEditItem] = useState<CondicionPago | undefined>()
  const [formOpen, setFormOpen] = useState(false)
  const [deleteItem, setDeleteItem] = useState<CondicionPago | undefined>()

  const { data, isPending } = useQuery({
    queryKey: ['condiciones-pago'],
    queryFn: () => condicionesPagoService.list(),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => condicionesPagoService.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['condiciones-pago'] })
      toast.success('Condición de Pago eliminada')
      setDeleteItem(undefined)
    },
    onError: (e: Error) => toast.error(e.message || 'Error al eliminar la Condición de Pago'),
  })

  if (isPending) return <p className='text-sm text-muted-foreground'>Cargando...</p>

  return (
    <div className='space-y-3'>
      {(data?.data ?? []).length === 0 ? (
        <p className='text-sm text-muted-foreground'>No hay condiciones de pago creadas.</p>
      ) : (
        <div className='space-y-2'>
          {data!.data.map((c) => (
            <div key={c.id} className='rounded-md border p-3'>
              <div className='flex items-center justify-between'>
                <p className='font-medium'>{c.codigo} — {c.descripcion}</p>
                {puedeEscribir && (
                  <div className='flex gap-1'>
                    <Button variant='ghost' size='icon' className='h-8 w-8' onClick={() => { setEditItem(c); setFormOpen(true) }}>
                      <Icons.edit className='h-4 w-4' />
                    </Button>
                    <Button variant='ghost' size='icon' className='h-8 w-8' onClick={() => setDeleteItem(c)}>
                      <Icons.trash className='h-4 w-4' />
                    </Button>
                  </div>
                )}
              </div>
              <div className='mt-2 flex flex-wrap gap-2'>
                {c.cuotas.map((cuota) => (
                  <Badge key={cuota.id} variant='outline'>
                    {cuota.porcentaje}% a {cuota.plazoDias} días{cuota.descripcion ? ` — ${cuota.descripcion}` : ''}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <CondicionPagoFormSheet
        item={editItem}
        open={formOpen}
        onOpenChange={(v) => { setFormOpen(v); if (!v) setEditItem(undefined) }}
      />
      <AlertModal
        isOpen={!!deleteItem}
        onClose={() => setDeleteItem(undefined)}
        onConfirm={() => deleteItem && deleteMutation.mutate(deleteItem.id)}
        loading={deleteMutation.isPending}
        title='Eliminar Condición de Pago'
        description='¿Eliminar esta Condición de Pago? Las Órdenes de Compra que ya la usaron conservan su copia de las cuotas.'
      />
    </div>
  )
}
