'use client'

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
import {
  mantenedorSimpleSchema,
  type MantenedorSimpleFormValues
} from '@/features/mantenedor-simple/schema'
import type { MantenedorSimple } from '@/features/mantenedor-simple/types'

interface MantenedorFormSheetProps {
  recurso: string
  titulo: string
  item?: MantenedorSimple
  open: boolean
  onOpenChange: (open: boolean) => void
  extraFields?: React.ReactNode
}

export function MantenedorFormSheet({
  recurso,
  titulo,
  item,
  open,
  onOpenChange,
  extraFields
}: MantenedorFormSheetProps) {
  const isEdit = !!item
  const queryClient = useQueryClient()
  const mutations = createMantenedorMutations(recurso)
  const { keys } = createMantenedorQueries(recurso)
  const codigoValidator = React.useMemo(() => createCodigoValidator(recurso), [recurso])

  const createMutation = useMutation({
    ...mutations.create,
    onSuccess: () => {
      toast.success(`${titulo} creado correctamente`)
      onOpenChange(false)
      form.reset()
      queryClient.invalidateQueries({ queryKey: keys.all })
    },
    onError: (e: Error) => toast.error(e.message || `Error al crear ${titulo.toLowerCase()}`)
  })

  const updateMutation = useMutation({
    ...mutations.update,
    onSuccess: () => {
      toast.success(`${titulo} actualizado correctamente`)
      onOpenChange(false)
      queryClient.invalidateQueries({ queryKey: keys.all })
    },
    onError: (e: Error) => toast.error(e.message || `Error al actualizar ${titulo.toLowerCase()}`)
  })

  const form = useAppForm({
    defaultValues: {
      codigo: item?.codigo ?? '',
      descripcion: item?.descripcion ?? '',
      descripcionExtranjera: item?.descripcionExtranjera ?? '',
      bloqueado: item?.bloqueado ?? false,
    } as MantenedorSimpleFormValues,
    validators: { onSubmit: mantenedorSimpleSchema },
    onSubmit: async ({ value }: { value: MantenedorSimpleFormValues }) => {
      if (isEdit) {
        await updateMutation.mutateAsync({ id: item.id, values: value })
      } else {
        await createMutation.mutateAsync(value)
      }
    }
  })

  const { FormTextField, FormSwitchField } = useFormFields<MantenedorSimpleFormValues>()

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='flex flex-col sm:max-w-md'>
        <SheetHeader>
          <SheetTitle>{isEdit ? `Editar ${titulo}` : `Nuevo ${titulo}`}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? `Modifica los datos del registro.`
              : `Completa los datos para registrar un nuevo registro.`}
          </SheetDescription>
        </SheetHeader>

        <div className='flex-1 overflow-auto py-2'>
          <form.AppForm>
            <form.Form id='mantenedor-form' className='space-y-4 px-1'>
              <FormTextField
                name='codigo'
                label='Código'
                required
                placeholder='Ej: COD01'
                disabled={isEdit}
                validators={isEdit ? undefined : codigoValidator}
              />
              <FormTextField
                name='descripcion'
                label='Descripción'
                required
                placeholder='Descripción del registro'
              />
              <FormTextField
                name='descripcionExtranjera'
                label='Descripción extranjera'
                placeholder='Foreign description'
              />
              {extraFields}
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
          <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type='submit' form='mantenedor-form' isLoading={isPending}>
            <Icons.check className='mr-1 h-4 w-4' />
            {isEdit ? 'Guardar cambios' : `Crear ${titulo.toLowerCase()}`}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

interface MantenedorFormSheetTriggerProps {
  recurso: string
  titulo: string
  extraFields?: React.ReactNode
}

export function MantenedorFormSheetTrigger({
  recurso,
  titulo,
  extraFields
}: MantenedorFormSheetTriggerProps) {
  const [open, setOpen] = React.useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Icons.add className='mr-2 h-4 w-4' />
        {`Nuevo ${titulo.toLowerCase()}`}
      </Button>
      <MantenedorFormSheet
        recurso={recurso}
        titulo={titulo}
        open={open}
        onOpenChange={setOpen}
        extraFields={extraFields}
      />
    </>
  )
}

// Need React import for useState in trigger
import React from 'react'
