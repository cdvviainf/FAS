'use client'

import { useState, useMemo } from 'react'
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
import { z } from 'zod'
import { createMantenedorMutations } from '@/features/mantenedor-simple/mutations'
import { createMantenedorQueries } from '@/features/mantenedor-simple/queries'
import { createCodigoValidator } from '@/features/mantenedor-simple/service'
import type { MantenedorSimple } from '@/features/mantenedor-simple/types'

const temporadaSchema = z.object({
  codigo: z.string().min(1, 'Requerido').max(50).trim(),
  descripcion: z.string().min(1, 'Requerido').max(200).trim(),
  descripcionExtranjera: z.string().max(200).trim().optional(),
  fechaInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Selecciona una fecha'),
  fechaTermino: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Selecciona una fecha'),
  predeterminada: z.boolean(),
  bloqueado: z.boolean(),
}).refine((d) => d.fechaInicio <= d.fechaTermino, {
  message: 'La fecha de inicio debe ser anterior o igual a la fecha de término',
  path: ['fechaTermino'],
})

type TemporadaFormValues = z.infer<typeof temporadaSchema>

interface TemporadaItem extends MantenedorSimple {
  fechaInicio?: string
  fechaTermino?: string
  predeterminada?: boolean
}

interface TemporadaFormSheetProps {
  item?: TemporadaItem
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TemporadaFormSheet({ item, open, onOpenChange }: TemporadaFormSheetProps) {
  const isEdit = !!item
  const queryClient = useQueryClient()
  const mutations = createMantenedorMutations('temporadas')
  const { keys } = createMantenedorQueries('temporadas')
  const codigoValidator = useMemo(() => createCodigoValidator('temporadas'), [])

  const form = useAppForm({
    defaultValues: {
      codigo: item?.codigo ?? '',
      descripcion: item?.descripcion ?? '',
      descripcionExtranjera: item?.descripcionExtranjera ?? '',
      fechaInicio: item?.fechaInicio ? item.fechaInicio.slice(0, 10) : '',
      fechaTermino: item?.fechaTermino ? item.fechaTermino.slice(0, 10) : '',
      predeterminada: item?.predeterminada ?? false,
      bloqueado: item?.bloqueado ?? false,
    } as TemporadaFormValues,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    validators: { onSubmit: temporadaSchema as any },
    onSubmit: async ({ value }) => {
      if (isEdit) {
        await updateMutation.mutateAsync({ id: item.id, values: value })
      } else {
        await createMutation.mutateAsync(value)
      }
    }
  })

  const createMutation = useMutation({
    ...mutations.create,
    onSuccess: () => {
      toast.success('Temporada creada correctamente')
      onOpenChange(false)
      form.reset()
      queryClient.invalidateQueries({ queryKey: keys.all })
    },
    onError: (e: Error) => toast.error(e.message || 'Error al crear la temporada')
  })

  const updateMutation = useMutation({
    ...mutations.update,
    onSuccess: () => {
      toast.success('Temporada actualizada correctamente')
      onOpenChange(false)
      queryClient.invalidateQueries({ queryKey: keys.all })
    },
    onError: (e: Error) => toast.error(e.message || 'Error al actualizar la temporada')
  })

  const { FormTextField, FormSwitchField } = useFormFields<TemporadaFormValues>()
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
          <SheetTitle>{isEdit ? 'Editar Temporada' : 'Nueva Temporada'}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? 'Modifica los datos de la temporada.'
              : 'Registra una nueva temporada frutera. Los rangos no pueden solaparse.'}
          </SheetDescription>
        </SheetHeader>

        <div className='flex-1 overflow-auto py-2'>
          <form.AppForm>
            <form.Form id='temporada-form' className='space-y-4 px-1'>
              <FormTextField
                name='codigo'
                label='Código'
                required
                placeholder='Ej: 2025-2026'
                disabled={isEdit}
                validators={isEdit ? undefined : codigoValidator}
              />
              <FormTextField
                name='descripcion'
                label='Descripción'
                required
                placeholder='Ej: Temporada 2025-2026'
              />
              <FormTextField
                name='descripcionExtranjera'
                label='Descripción extranjera'
                placeholder='Ej: Season 2025-2026'
              />
              <FormTextField
                name='fechaInicio'
                label='Fecha de inicio'
                required
                type='date'
              />
              <FormTextField
                name='fechaTermino'
                label='Fecha de término'
                required
                type='date'
              />
              <FormSwitchField
                name='predeterminada'
                label='Predeterminada'
                description='La temporada predeterminada se carga automáticamente al iniciar sesión. Solo puede haber una.'
              />
              {isEdit && (
                <FormSwitchField
                  name='bloqueado'
                  label='Bloqueado'
                  description='Una temporada bloqueada no aparece en los selectores de nuevos registros.'
                />
              )}
            </form.Form>
          </form.AppForm>
        </div>

        <SheetFooter>
          <Button type='button' variant='outline' onClick={() => handleOpenChange(false)}>Cancelar</Button>
          <Button type='submit' form='temporada-form' isLoading={isPending}>
            <Icons.check className='mr-1 h-4 w-4' />
            {isEdit ? 'Guardar cambios' : 'Crear temporada'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

export function TemporadaFormSheetTrigger() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Icons.add className='mr-2 h-4 w-4' />
        Nueva temporada
      </Button>
      <TemporadaFormSheet open={open} onOpenChange={setOpen} />
    </>
  )
}
