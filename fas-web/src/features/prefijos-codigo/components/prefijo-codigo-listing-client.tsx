'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Icons } from '@/components/icons'
import { AlertModal } from '@/components/modal/alert-modal'
import { usePuedeEscribir } from '@/hooks/use-item-acceso'
import { prefijosCodigoService } from '../service'
import { MODELOS_CON_CODIGO_OPTIONS, MODELO_EMBARQUE_OPTION } from '../types'
import type { PrefijoCodigo } from '../types'
import { PrefijoCodigoFormSheet } from './prefijo-codigo-form-sheet'

const ITEM = 'CONFIG_MANTENEDORES'
const TODAS_LAS_OPCIONES = [...MODELOS_CON_CODIGO_OPTIONS, MODELO_EMBARQUE_OPTION]

function labelDeModelo(modelo: string): string {
  return TODAS_LAS_OPCIONES.find((m) => m.value === modelo)?.label ?? modelo
}

export function PrefijoCodigoListingClient() {
  const puedeEscribir = usePuedeEscribir(ITEM)
  const queryClient = useQueryClient()
  const [editItem, setEditItem] = useState<PrefijoCodigo | undefined>()
  const [formOpen, setFormOpen] = useState(false)
  const [deleteItem, setDeleteItem] = useState<PrefijoCodigo | undefined>()

  const { data, isPending } = useQuery({
    queryKey: ['prefijos-codigo'],
    queryFn: () => prefijosCodigoService.list(),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => prefijosCodigoService.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prefijos-codigo'] })
      toast.success('Prefijo eliminado')
      setDeleteItem(undefined)
    },
    onError: (e: Error) => toast.error(e.message || 'Error al eliminar el prefijo'),
  })

  if (isPending) return <p className='text-sm text-muted-foreground'>Cargando...</p>

  return (
    <div className='space-y-3'>
      {(data?.data ?? []).length === 0 ? (
        <p className='text-sm text-muted-foreground'>No hay prefijos configurados.</p>
      ) : (
        <div className='space-y-2'>
          {data!.data.map((p) => (
            <div key={p.id} className='flex items-center justify-between rounded-md border p-3'>
              <p className='font-medium'>
                {labelDeModelo(p.modelo)}{p.tipoEmbarque && <> ({p.tipoEmbarque.descripcion})</>} — <span className='font-mono text-muted-foreground'>{p.prefijo}{'0'.repeat(p.digitos)}</span>
              </p>
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

      <PrefijoCodigoFormSheet
        item={editItem}
        open={formOpen}
        onOpenChange={(v) => { setFormOpen(v); if (!v) setEditItem(undefined) }}
      />
      <AlertModal
        isOpen={!!deleteItem}
        onClose={() => setDeleteItem(undefined)}
        onConfirm={() => deleteItem && deleteMutation.mutate(deleteItem.id)}
        loading={deleteMutation.isPending}
        title='Eliminar Prefijo de Código'
        description='¿Eliminar este prefijo? El mantenedor dejará de sugerir un código automáticamente.'
      />
    </div>
  )
}
