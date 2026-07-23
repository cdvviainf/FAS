'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Icons } from '@/components/icons'
import { AlertModal } from '@/components/modal/alert-modal'
import { usePuedeEscribir } from '@/hooks/use-item-acceso'
import { conceptosLiquidacionService } from '../service'
import { FORMA_APLICACION_LABELS, NATURALEZA_CONCEPTO_LABELS } from '../types'
import type { ConceptoLiquidacion } from '../types'
import { ConceptoFormSheet } from './concepto-form-sheet'

const ITEM = 'config.conceptos-liquidacion'

export function ConceptoListingClient() {
  const puedeEscribir = usePuedeEscribir(ITEM)
  const queryClient = useQueryClient()
  const [editItem, setEditItem] = useState<ConceptoLiquidacion | undefined>()
  const [formOpen, setFormOpen] = useState(false)
  const [deleteItem, setDeleteItem] = useState<ConceptoLiquidacion | undefined>()

  const { data, isPending } = useQuery({
    queryKey: ['conceptos-liquidacion'],
    queryFn: () => conceptosLiquidacionService.list(),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => conceptosLiquidacionService.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conceptos-liquidacion'] })
      toast.success('Concepto eliminado')
      setDeleteItem(undefined)
    },
    onError: (e: Error) => toast.error(e.message || 'Error al eliminar el concepto'),
  })

  if (isPending) return <p className='text-sm text-muted-foreground'>Cargando...</p>

  return (
    <div className='space-y-3'>
      {(data?.data ?? []).length === 0 ? (
        <p className='text-sm text-muted-foreground'>No hay conceptos de liquidación creados.</p>
      ) : (
        <div className='space-y-2'>
          {data!.data.map((c) => (
            <div key={c.id} className='rounded-md border p-3'>
              <div className='flex items-center justify-between'>
                <div>
                  <p className='font-medium'>{c.codigo} — {c.descripcion}</p>
                  <div className='mt-1 flex gap-2'>
                    <Badge variant='outline'>{FORMA_APLICACION_LABELS[c.formaAplicacion]}</Badge>
                    <Badge variant={c.naturaleza === 'ABONO' ? 'default' : 'secondary'}>{NATURALEZA_CONCEPTO_LABELS[c.naturaleza]}</Badge>
                  </div>
                </div>
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
              {c.valores.length > 0 && (
                <div className='mt-2 grid grid-cols-2 gap-1 text-xs text-muted-foreground sm:grid-cols-3'>
                  {c.valores.map((v) => (
                    <span key={v.id}>{v.especie.descripcion}: {v.valor}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <ConceptoFormSheet
        item={editItem}
        open={formOpen}
        onOpenChange={(v) => { setFormOpen(v); if (!v) setEditItem(undefined) }}
      />
      <AlertModal
        isOpen={!!deleteItem}
        onClose={() => setDeleteItem(undefined)}
        onConfirm={() => deleteItem && deleteMutation.mutate(deleteItem.id)}
        loading={deleteMutation.isPending}
        title='Eliminar concepto'
        description='¿Eliminar este concepto de liquidación?'
      />
    </div>
  )
}
