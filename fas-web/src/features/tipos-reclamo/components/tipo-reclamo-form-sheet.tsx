'use client'

import { useState } from 'react'
import { useAppForm, useFormFields } from '@/components/ui/tanstack-form'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
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
import type { MantenedorSimple } from '@/features/mantenedor-simple/types'

// Mantenedor propio (2026-10-01): código/descripción + el flag que decide si un
// reclamo de este tipo requiere análisis de Calidad (y por lo tanto aparece en
// la pantalla de Calidad).
const tipoReclamoSchema = z.object({
  codigo: z.string().min(1, 'Requerido').max(50).trim(),
  descripcion: z.string().min(1, 'Requerido').max(200).trim(),
  descripcionExtranjera: z.string().max(200).trim().optional(),
  generaAnalisisCalidad: z.boolean()
})

type TipoReclamoFormValues = z.infer<typeof tipoReclamoSchema>

interface TipoReclamoItem extends MantenedorSimple {
  generaAnalisisCalidad?: boolean
}

interface TipoReclamoFormSheetProps {
  item?: TipoReclamoItem
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TipoReclamoFormSheet({ item, open, onOpenChange }: TipoReclamoFormSheetProps) {
  const isEdit = !!item
  const queryClient = useQueryClient()
  const mutations = createMantenedorMutations('tipos-reclamo')
  const { keys } = createMantenedorQueries('tipos-reclamo')

  const createMutation = useMutation({
    ...mutations.create,
    onSuccess: () => {
      toast.success('Tipo de Reclamo creado correctamente')
      onOpenChange(false)
      form.reset()
      queryClient.invalidateQueries({ queryKey: keys.all })
    },
    onError: (e: Error) => toast.error(e.message || 'Error al crear el tipo de reclamo')
  })

  const updateMutation = useMutation({
    ...mutations.update,
    onSuccess: () => {
      toast.success('Tipo de Reclamo actualizado correctamente')
      onOpenChange(false)
      queryClient.invalidateQueries({ queryKey: keys.all })
    },
    onError: (e: Error) => toast.error(e.message || 'Error al actualizar el tipo de reclamo')
  })

  const form = useAppForm({
    defaultValues: {
      codigo: item?.codigo ?? '',
      descripcion: item?.descripcion ?? '',
      descripcionExtranjera: item?.descripcionExtranjera ?? '',
      generaAnalisisCalidad: item?.generaAnalisisCalidad ?? false
    } as TipoReclamoFormValues,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    validators: { onSubmit: tipoReclamoSchema as any },
    onSubmit: async ({ value }) => {
      if (isEdit) {
        await updateMutation.mutateAsync({ id: item.id, values: value })
      } else {
        await createMutation.mutateAsync(value)
      }
    }
  })

  const { FormTextField } = useFormFields<TipoReclamoFormValues>()
  const isPending = createMutation.isPending || updateMutation.isPending

  // El Sheet permanece montado entre aperturas (lo controla el padre vía `open`),
  // así que hay que resetear el form manualmente al cerrar.
  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) form.reset()
    onOpenChange(nextOpen)
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className='flex flex-col sm:max-w-md'>
        <SheetHeader>
          <SheetTitle>{isEdit ? 'Editar Tipo de Reclamo' : 'Nuevo Tipo de Reclamo'}</SheetTitle>
          <SheetDescription>
            {isEdit ? 'Modifica los datos del tipo de reclamo.' : 'Completa los datos para registrar un nuevo tipo de reclamo.'}
          </SheetDescription>
        </SheetHeader>

        <div className='flex-1 overflow-auto py-2'>
          <form.AppForm>
            <form.Form id='tipo-reclamo-form' className='space-y-4 px-1'>
              <FormTextField name='codigo' label='Código' required placeholder='Ej: CALIDAD' disabled={isEdit} />
              <FormTextField name='descripcion' label='Descripción' required placeholder='Ej: Calidad' />
              <FormTextField name='descripcionExtranjera' label='Descripción extranjera' placeholder='Ej: Quality' />

              <div className='space-y-3 rounded-lg border p-3'>
                <p className='text-xs text-muted-foreground'>
                  Si se activa, los reclamos de este tipo pasan a Calidad para su análisis
                  (aparecen en la pantalla de Calidad). Si no, son solo de Ventas.
                </p>
                <form.Field name='generaAnalisisCalidad'>
                  {(field) => (
                    <div className='flex items-center gap-3'>
                      <Switch
                        id='generaAnalisisCalidad'
                        checked={!!field.state.value}
                        onCheckedChange={(v) => field.handleChange(v)}
                      />
                      <Label htmlFor='generaAnalisisCalidad' className='font-medium'>Genera análisis de Calidad</Label>
                    </div>
                  )}
                </form.Field>
              </div>
            </form.Form>
          </form.AppForm>
        </div>

        <SheetFooter>
          <Button type='button' variant='outline' onClick={() => handleOpenChange(false)}>Cancelar</Button>
          <Button type='submit' form='tipo-reclamo-form' isLoading={isPending}>
            <Icons.check className='mr-1 h-4 w-4' />
            {isEdit ? 'Guardar cambios' : 'Crear tipo de reclamo'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

export function TipoReclamoFormSheetTrigger() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Icons.add className='mr-2 h-4 w-4' />
        Nuevo tipo de reclamo
      </Button>
      <TipoReclamoFormSheet open={open} onOpenChange={setOpen} />
    </>
  )
}
