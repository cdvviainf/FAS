'use client'

import { useState } from 'react'
import { useAppForm, useFormFields } from '@/components/ui/tanstack-form'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Icons } from '@/components/icons'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createMantenedorMutations } from '@/features/mantenedor-simple/mutations'
import { createMantenedorQueries } from '@/features/mantenedor-simple/queries'
import { mantenedorSimpleSchema, type MantenedorSimpleFormValues } from '@/features/mantenedor-simple/schema'
import { usePuedeEscribir } from '@/hooks/use-item-acceso'
import type { MantenedorSimple } from '@/features/mantenedor-simple/types'

interface TipoEmbarqueQuickCreateProps {
  onCreated: (item: MantenedorSimple) => void
}

function TipoEmbarqueQuickDialog({
  open,
  onOpenChange,
  onCreated
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreated: (item: MantenedorSimple) => void
}) {
  const queryClient = useQueryClient()
  const mutations = createMantenedorMutations('tipos-embarque')
  const { keys } = createMantenedorQueries('tipos-embarque')

  const mutation = useMutation({
    ...mutations.create,
    onSuccess: (newItem) => {
      queryClient.invalidateQueries({ queryKey: keys.all })
      toast.success(`Tipo de Embarque "${newItem.descripcion}" creado`)
      onCreated(newItem)
      onOpenChange(false)
      form.reset()
    },
    onError: () => toast.error('Error al crear el tipo de embarque')
  })

  const form = useAppForm({
    defaultValues: { codigo: '', descripcion: '', descripcionExtranjera: '' } as MantenedorSimpleFormValues,
    validators: { onSubmit: mantenedorSimpleSchema },
    onSubmit: async ({ value }) => { await mutation.mutateAsync(value) }
  })

  const { FormTextField } = useFormFields<MantenedorSimpleFormValues>()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-sm'>
        <DialogHeader>
          <DialogTitle>Nuevo Tipo de Embarque</DialogTitle>
          <DialogDescription>
            El tipo quedará disponible inmediatamente en el selector.
          </DialogDescription>
        </DialogHeader>

        <form.AppForm>
          <form.Form id='tipo-embarque-quick-form' className='space-y-3'>
            <FormTextField name='codigo' label='Código' required placeholder='Ej: MARITIMO' />
            <FormTextField name='descripcion' label='Descripción' required placeholder='Ej: Marítimo' />
            <FormTextField name='descripcionExtranjera' label='Descripción extranjera' placeholder='Ej: Maritime' />
          </form.Form>
        </form.AppForm>

        <DialogFooter>
          <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type='submit' form='tipo-embarque-quick-form' isLoading={mutation.isPending}>
            <Icons.check className='mr-1 h-4 w-4' />
            Crear tipo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function TipoEmbarqueQuickCreate({ onCreated }: TipoEmbarqueQuickCreateProps) {
  const [open, setOpen] = useState(false)
  const puedeEscribir = usePuedeEscribir('config.tipos-embarque')

  if (!puedeEscribir) return null

  return (
    <>
      <Button
        type='button'
        variant='outline'
        size='icon'
        className='h-9 w-9 shrink-0 self-end'
        onClick={() => setOpen(true)}
        title='Crear nuevo tipo de embarque'
      >
        <Icons.add className='h-4 w-4' />
      </Button>
      <TipoEmbarqueQuickDialog open={open} onOpenChange={setOpen} onCreated={onCreated} />
    </>
  )
}
