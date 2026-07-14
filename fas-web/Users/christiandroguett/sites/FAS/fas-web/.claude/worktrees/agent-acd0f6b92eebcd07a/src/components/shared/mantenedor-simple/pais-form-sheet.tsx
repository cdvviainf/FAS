'use client'

import React, { useState } from 'react'
import { useAppForm, useFormFields } from '@/components/ui/tanstack-form'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet'
import { Icons } from '@/components/icons'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createMantenedorMutations } from '@/features/mantenedor-simple/mutations'
import { createMantenedorQueries } from '@/features/mantenedor-simple/queries'
import { paisSchema, type PaisFormValues } from '@/features/mantenedor-simple/schema'
import type { MantenedorSimple } from '@/features/mantenedor-simple/types'

interface PaisItem extends MantenedorSimple {
  esPaisOrigen?: boolean
}

interface PaisFormSheetProps {
  item?: PaisItem
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PaisFormSheet({ item, open, onOpenChange }: PaisFormSheetProps) {
  const isEdit = !!item
  const queryClient = useQueryClient()
  const mutations = createMantenedorMutations('paises')
  const { keys } = createMantenedorQueries('paises')

  const createMutation = useMutation({
    ...mutations.create,
    onSuccess: () => {
      toast.success('País creado correctamente')
      onOpenChange(false)
      form.reset()
      queryClient.invalidateQueries({ queryKey: keys.all })
    },
    onError: (e: Error) => toast.error(e.message || 'Error al crear el país')
  })

  const updateMutation = useMutation({
    ...mutations.update,
    onSuccess: () => {
      toast.success('País actualizado correctamente')
      onOpenChange(false)
      queryClient.invalidateQueries({ queryKey: keys.all })
    },
    onError: (e: Error) => toast.error(e.message || 'Error al actualizar el país')
  })

  const form = useAppForm({
    defaultValues: {
      codigo: item?.codigo ?? '',
      descripcion: item?.descripcion ?? '',
      descripcionExtranjera: item?.descripcionExtranjera ?? '',
      esPaisOrigen: item?.esPaisOrigen ?? false
    } as PaisFormValues,
    validators: { onSubmit: paisSchema },
    onSubmit: async ({ value }: { value: PaisFormValues }) => {
      if (isEdit) {
        await updateMutation.mutateAsync({ id: item.id, values: value })
      } else {
        await createMutation.mutateAsync(value)
      }
    }
  })

  const { FormTextField, FormSwitchField } = useFormFields<PaisFormValues>()

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='flex flex-col sm:max-w-md'>
        <SheetHeader>
          <SheetTitle>{isEdit ? 'Editar País' : 'Nuevo País'}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? 'Modifica los datos del país.'
              : 'Completa los datos para registrar un nuevo país.'}
          </SheetDescription>
        </SheetHeader>

        <div className='flex-1 overflow-auto py-2'>
          <form.AppForm>
            <form.Form id='pais-form' className='space-y-4 px-1'>
              <FormTextField
                name='codigo'
                label='Código ISO alfa-3'
                required
                placeholder='Ej: CHL, USA, CHN'
                disabled={isEdit}
              />
              <FormTextField
                name='descripcion'
                label='Descripción'
                required
                placeholder='Ej: Chile'
              />
              <FormTextField
                name='descripcionExtranjera'
                label='Descripción extranjera'
                placeholder='Ej: Chile'
              />
              <FormSwitchField name='esPaisOrigen' label='Es país de origen' />
            </form.Form>
          </form.AppForm>
        </div>

        <SheetFooter>
          <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type='submit' form='pais-form' isLoading={isPending}>
            <Icons.check className='mr-1 h-4 w-4' />
            {isEdit ? 'Guardar cambios' : 'Crear país'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

export function PaisFormSheetTrigger() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Icons.add className='mr-2 h-4 w-4' />
        Nuevo país
      </Button>
      <PaisFormSheet open={open} onOpenChange={setOpen} />
    </>
  )
}
