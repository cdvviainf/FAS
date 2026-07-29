'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Icons } from '@/components/icons'
import { AlertModal } from '@/components/modal/alert-modal'
import { usePuedeEscribir } from '@/hooks/use-item-acceso'
import { templatesCargaService } from '../service'
import { CAMPO_TEMPLATE_CARGA_LABELS } from '../types'
import type { TemplateCarga } from '../types'
import { TemplateCargaFormSheet } from './template-carga-form-sheet'

const ITEM = 'CONFIG_MANTENEDORES'

export function TemplateCargaListingClient() {
  const puedeEscribir = usePuedeEscribir(ITEM)
  const queryClient = useQueryClient()
  const [editItem, setEditItem] = useState<TemplateCarga | undefined>()
  const [formOpen, setFormOpen] = useState(false)
  const [deleteItem, setDeleteItem] = useState<TemplateCarga | undefined>()

  const { data, isPending } = useQuery({
    queryKey: ['templates-carga'],
    queryFn: () => templatesCargaService.list(),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => templatesCargaService.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates-carga'] })
      toast.success('Template de Carga eliminado')
      setDeleteItem(undefined)
    },
    onError: (e: Error) => toast.error(e.message || 'Error al eliminar el Template de Carga'),
  })

  if (isPending) return <p className='text-sm text-muted-foreground'>Cargando...</p>

  return (
    <div className='space-y-3'>
      {(data?.data ?? []).length === 0 ? (
        <p className='text-sm text-muted-foreground'>No hay templates de carga creados.</p>
      ) : (
        <div className='space-y-2'>
          {data!.data.map((t) => (
            <div key={t.id} className='rounded-md border p-3'>
              <div className='flex items-center justify-between'>
                <div>
                  <p className='font-medium'>{t.codigo} — {t.descripcion}</p>
                  <p className='text-xs text-muted-foreground'>
                    {t.tieneCabecera ? `Con cabecera (fila ${t.filaCabecera})` : 'Sin cabecera'} · Primer registro: fila {t.filaPrimerRegistro}
                  </p>
                </div>
                {puedeEscribir && (
                  <div className='flex gap-1'>
                    <Button variant='ghost' size='icon' className='h-8 w-8' onClick={() => { setEditItem(t); setFormOpen(true) }}>
                      <Icons.edit className='h-4 w-4' />
                    </Button>
                    <Button variant='ghost' size='icon' className='h-8 w-8' onClick={() => setDeleteItem(t)}>
                      <Icons.trash className='h-4 w-4' />
                    </Button>
                  </div>
                )}
              </div>
              <div className='mt-2 flex flex-wrap gap-2'>
                {t.campos.map((c) => (
                  <Badge key={c.id} variant='outline'>
                    {CAMPO_TEMPLATE_CARGA_LABELS[c.campo]} → {c.columna}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <TemplateCargaFormSheet
        item={editItem}
        open={formOpen}
        onOpenChange={(v) => { setFormOpen(v); if (!v) setEditItem(undefined) }}
      />
      <AlertModal
        isOpen={!!deleteItem}
        onClose={() => setDeleteItem(undefined)}
        onConfirm={() => deleteItem && deleteMutation.mutate(deleteItem.id)}
        loading={deleteMutation.isPending}
        title='Eliminar Template de Carga'
        description='¿Eliminar este Template de Carga? Las Recepciones que ya lo usaron conservan la referencia.'
      />
    </div>
  )
}
