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

interface EspecieQuickCreateProps {
  onCreated: (especie: MantenedorSimple) => void
}

function EspecieQuickDialog({
  open,
  onOpenChange,
  onCreated
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreated: (especie: MantenedorSimple) => void
}) {
  const queryClient = useQueryClient()
  const mutations = createMantenedorMutations('especies')
  const { keys } = createMantenedorQueries('especies')

  const mutation = useMutation({
    ...mutations.create,
    onSuccess: (newEspecie) => {
      queryClient.invalidateQueries({ queryKey: keys.all })
      toast.success(`Especie "${newEspecie.descripcion}" creada`)
      onCreated(newEspecie)
      onOpenChange(false)
      form.reset()
    },
    onError: () => toast.error('Error al crear la especie')
  })

  const form = useAppForm({
    defaultValues: {
      codigo: '',
      descripcion: '',
      descripcionExtranjera: '',
      bloqueado: false
    } as MantenedorSimpleFormValues,
    validators: { onSubmit: mantenedorSimpleSchema },
    onSubmit: async ({ value }) => { await mutation.mutateAsync(value) }
  })

  const { FormTextField } = useFormFields<MantenedorSimpleFormValues>()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-sm'>
        <DialogHeader>
          <DialogTitle>Nueva Especie</DialogTitle>
          <DialogDescription>
            La especie quedará disponible inmediatamente en el selector.
          </DialogDescription>
        </DialogHeader>

        <form.AppForm>
          <form.Form id='especie-quick-form' className='space-y-3'>
            <FormTextField name='codigo' label='Código' required placeholder='Ej: UVA' />
            <FormTextField name='descripcion' label='Descripción' required placeholder='Ej: Uva de Mesa' />
            <FormTextField name='descripcionExtranjera' label='Descripción extranjera' placeholder='Ej: Table Grape' />
          </form.Form>
        </form.AppForm>

        <DialogFooter>
          <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type='submit' form='especie-quick-form' isLoading={mutation.isPending}>
            <Icons.check className='mr-1 h-4 w-4' />
            Crear especie
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function EspecieQuickCreate({ onCreated }: EspecieQuickCreateProps) {
  const [open, setOpen] = useState(false)
  const puedeEscribir = usePuedeEscribir('config.especies')

  if (!puedeEscribir) return null

  return (
    <>
      <Button
        type='button'
        variant='outline'
        size='icon'
        className='h-9 w-9 shrink-0 self-end'
        onClick={() => setOpen(true)}
        title='Crear nueva especie'
      >
        <Icons.add className='h-4 w-4' />
      </Button>
      {open && <EspecieQuickDialog open onOpenChange={setOpen} onCreated={onCreated} />}
    </>
  )
}
