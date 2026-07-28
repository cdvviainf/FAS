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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createMantenedorMutations } from '@/features/mantenedor-simple/mutations'
import { createMantenedorQueries } from '@/features/mantenedor-simple/queries'
import { createCodigoValidator } from '@/features/mantenedor-simple/service'
import {
  mantenedorSimpleSchema,
  type MantenedorSimpleFormValues
} from '@/features/mantenedor-simple/schema'
import type { MantenedorSimple } from '@/features/mantenedor-simple/types'
import { prefijosCodigoService } from '@/features/prefijos-codigo/service'
import { RECURSO_A_MODELO } from '@/features/prefijos-codigo/types'

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

  // Sugerencia de código (Prefijos de Código) — solo al crear. Se aplica una
  // sola vez por apertura del Sheet para no pisar lo que el usuario escriba.
  const modeloPrefijo = RECURSO_A_MODELO[recurso]
  const { data: codigoSugerido } = useQuery({
    queryKey: ['prefijo-codigo-siguiente', modeloPrefijo],
    queryFn: () => prefijosCodigoService.siguienteCodigo(modeloPrefijo),
    enabled: open && !isEdit && !!modeloPrefijo,
    staleTime: 0,
  })

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

  React.useEffect(() => {
    if (open && !isEdit && codigoSugerido) {
      form.setFieldValue('codigo', codigoSugerido)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codigoSugerido, open, isEdit])

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
          <Button type='button' variant='outline' onClick={() => handleOpenChange(false)}>
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
