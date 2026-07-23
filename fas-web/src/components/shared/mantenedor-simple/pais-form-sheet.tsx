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
import { createCodigoValidator } from '@/features/mantenedor-simple/service'
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
  const codigoValidator = React.useMemo(() => createCodigoValidator('paises'), [])

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
      esPaisOrigen: item?.esPaisOrigen ?? false,
      bloqueado: item?.bloqueado ?? false
    } as PaisFormValues,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    validators: { onSubmit: paisSchema as any },
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

  // El Sheet permanece montado entre aperturas (lo controla el padre vía `open`),
  // asi que hay que resetear el form manualmente al cerrar (Cancelar, Escape, click afuera);
  // si no, reabrir "Nuevo" muestra los valores tipeados en la sesion anterior.
  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) form.reset()
    onOpenChange(nextOpen)
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
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
                validators={isEdit ? undefined : codigoValidator}
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
              {isEdit && (
                <FormSwitchField
                  name='bloqueado'
                  label='Bloqueado'
                  description='Un registro bloqueado no aparece en los selectores de nuevos registros.'
                />
              )}
            </form.Form>
          </form.AppForm>
        </div>

        <SheetFooter>
          <Button type='button' variant='outline' onClick={() => handleOpenChange(false)}>
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
