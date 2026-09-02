'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Icons } from '@/components/icons'
import { usePuedeEscribir } from '@/hooks/use-item-acceso'
import { embarquesService } from '../service'
import { embarquesKeys } from '../queries'
import type { EmbarqueDetalle } from '../types'

const ITEM = 'VENTAS_EMBARQUES'

export function DespacharTab({ embarque }: { embarque: EmbarqueDetalle }) {
  const puedeEscribir = usePuedeEscribir(ITEM)
  const queryClient = useQueryClient()

  const despacharMutation = useMutation({
    mutationFn: () => embarquesService.despachar(embarque.id),
    onSuccess: () => {
      toast.success('Despacho confirmado')
      queryClient.invalidateQueries({ queryKey: embarquesKeys.detail(embarque.id) })
    },
    onError: (e: Error) => toast.error(e.message || 'Error al confirmar el despacho'),
  })

  if (embarque.despachadoEn) {
    return (
      <div className='space-y-2 rounded-md border border-dashed p-6 text-center'>
        <Badge>Despachado</Badge>
        <p className='text-muted-foreground text-sm'>
          Confirmado el {new Date(embarque.despachadoEn).toLocaleString('es-CL')}
          {embarque.despachadoPor ? ` — ${embarque.despachadoPor}` : ''}
        </p>
      </div>
    )
  }

  return (
    <div className='space-y-3 rounded-md border p-6 text-center'>
      <p className='text-muted-foreground text-sm'>
        {embarque.pallets.length} pallet{embarque.pallets.length === 1 ? '' : 's'} reservado
        {embarque.pallets.length === 1 ? '' : 's'} a este Embarque.
      </p>
      {puedeEscribir && (
        <Button
          type='button'
          onClick={() => despacharMutation.mutate()}
          disabled={embarque.pallets.length === 0 || despacharMutation.isPending}
          isLoading={despacharMutation.isPending}
        >
          <Icons.check className='mr-1 h-4 w-4' /> Confirmar Despacho
        </Button>
      )}
    </div>
  )
}
