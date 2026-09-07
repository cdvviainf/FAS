'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Icons } from '@/components/icons'
import { AlertModal } from '@/components/modal/alert-modal'
import { usePuedeEscribir } from '@/hooks/use-item-acceso'
import { integracionesService } from '../service'
import { integracionesKeys } from '../queries'
import { MAESTRO_INTEGRACION_LABELS } from '../types'
import type { IntegracionParametro } from '../types'
import { ParametroFormSheet } from './parametro-form-sheet'

const ITEM = 'CONFIG_INTEGRACIONES'

export function ParametrosTab({ integracionId, parametros }: { integracionId: number; parametros: IntegracionParametro[] }) {
  const puedeEscribir = usePuedeEscribir(ITEM)
  const queryClient = useQueryClient()
  const [editItem, setEditItem] = useState<IntegracionParametro | undefined>()
  const [formOpen, setFormOpen] = useState(false)
  const [deleteItem, setDeleteItem] = useState<IntegracionParametro | undefined>()

  const deleteMutation = useMutation({
    mutationFn: (parametroId: number) => integracionesService.removeParametro(integracionId, parametroId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: integracionesKeys.detail(integracionId) })
      toast.success('Parámetro eliminado')
      setDeleteItem(undefined)
    },
    onError: (e: Error) => toast.error(e.message || 'Error al eliminar el parámetro'),
  })

  return (
    <div className='space-y-3'>
      {puedeEscribir && (
        <Button onClick={() => { setEditItem(undefined); setFormOpen(true) }}>
          <Icons.add className='mr-2 h-4 w-4' /> Nuevo Parámetro
        </Button>
      )}

      {parametros.length === 0 ? (
        <p className='text-sm text-muted-foreground'>Esta integración no tiene parámetros configurados.</p>
      ) : (
        <div className='space-y-2'>
          {parametros.map((p) => (
            <div key={p.id} className='flex items-center justify-between rounded-md border p-3'>
              <div className='space-y-0.5'>
                <div className='flex items-center gap-2'>
                  <span className='font-medium'>{p.idExterno}</span>
                  {p.tipo === 'MAESTRO' ? (
                    <Badge variant='outline'>{MAESTRO_INTEGRACION_LABELS[p.maestro!]}</Badge>
                  ) : (
                    <Badge variant='outline'>Texto</Badge>
                  )}
                  {p.sensible && <Badge variant='secondary'>Sensible</Badge>}
                </div>
                <p className='text-xs text-muted-foreground'>
                  {p.tipo === 'MAESTRO' ? p.valorLocal : p.valorExterno}
                  {p.descripcion ? ` · ${p.descripcion}` : ''}
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

      <ParametroFormSheet
        integracionId={integracionId}
        item={editItem}
        open={formOpen}
        onOpenChange={(v) => { setFormOpen(v); if (!v) setEditItem(undefined) }}
      />
      <AlertModal
        isOpen={!!deleteItem}
        onClose={() => setDeleteItem(undefined)}
        onConfirm={() => deleteItem && deleteMutation.mutate(deleteItem.id)}
        loading={deleteMutation.isPending}
        title='Eliminar parámetro'
        description='¿Eliminar este parámetro de la integración?'
      />
    </div>
  )
}
