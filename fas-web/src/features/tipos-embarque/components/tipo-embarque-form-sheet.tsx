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
import { usePuedeEscribir } from '@/hooks/use-item-acceso'

// Mantenedor propio (2026-10-08): código/descripción + Código Aduana (SII, vía de
// transporte del DTE 110) + el flag que decide si este tipo de embarque genera
// Solicitud de Reserva (solo Aéreo/Marítimo; Terrestre no reserva espacio).
const tipoEmbarqueSchema = z.object({
  codigo: z.string().min(1, 'Requerido').max(50).trim(),
  descripcion: z.string().min(1, 'Requerido').max(200).trim(),
  descripcionExtranjera: z.string().max(200).trim().optional(),
  codigoAduana: z.string().max(20).trim().optional(),
  requiereReserva: z.boolean(),
  bloqueado: z.boolean()
})

type TipoEmbarqueFormValues = z.infer<typeof tipoEmbarqueSchema>

interface TipoEmbarqueItem extends MantenedorSimple {
  requiereReserva?: boolean
}

interface TipoEmbarqueFormSheetProps {
  item?: TipoEmbarqueItem
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TipoEmbarqueFormSheet({ item, open, onOpenChange }: TipoEmbarqueFormSheetProps) {
  const isEdit = !!item
  const queryClient = useQueryClient()
  const mutations = createMantenedorMutations('tipos-embarque')
  const { keys } = createMantenedorQueries('tipos-embarque')

  const createMutation = useMutation({
    ...mutations.create,
    onSuccess: () => {
      toast.success('Tipo de Embarque creado correctamente')
      onOpenChange(false)
      form.reset()
      queryClient.invalidateQueries({ queryKey: keys.all })
    },
    onError: (e: Error) => toast.error(e.message || 'Error al crear el tipo de embarque')
  })

  const updateMutation = useMutation({
    ...mutations.update,
    onSuccess: () => {
      toast.success('Tipo de Embarque actualizado correctamente')
      onOpenChange(false)
      queryClient.invalidateQueries({ queryKey: keys.all })
    },
    onError: (e: Error) => toast.error(e.message || 'Error al actualizar el tipo de embarque')
  })

  const form = useAppForm({
    defaultValues: {
      codigo: item?.codigo ?? '',
      descripcion: item?.descripcion ?? '',
      descripcionExtranjera: item?.descripcionExtranjera ?? '',
      codigoAduana: item?.codigoAduana ?? '',
      requiereReserva: item?.requiereReserva ?? false,
      bloqueado: item?.bloqueado ?? false
    } as TipoEmbarqueFormValues,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    validators: { onSubmit: tipoEmbarqueSchema as any },
    onSubmit: async ({ value }) => {
      if (isEdit) {
        await updateMutation.mutateAsync({ id: item.id, values: value })
      } else {
        await createMutation.mutateAsync(value)
      }
    }
  })

  const { FormTextField } = useFormFields<TipoEmbarqueFormValues>()
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
          <SheetTitle>{isEdit ? 'Editar Tipo de Embarque' : 'Nuevo Tipo de Embarque'}</SheetTitle>
          <SheetDescription>
            {isEdit ? 'Modifica los datos del tipo de embarque.' : 'Completa los datos para registrar un nuevo tipo de embarque.'}
          </SheetDescription>
        </SheetHeader>

        <div className='flex-1 overflow-auto py-2'>
          <form.AppForm>
            <form.Form id='tipo-embarque-form' className='space-y-4 px-1'>
              <FormTextField name='codigo' label='Código' required placeholder='Ej: MARITIMO' disabled={isEdit} />
              <FormTextField name='descripcion' label='Descripción' required placeholder='Ej: Marítimo' />
              <FormTextField name='descripcionExtranjera' label='Descripción extranjera' placeholder='Ej: Sea freight' />
              <FormTextField
                name='codigoAduana'
                label='Código Aduana (SII)'
                placeholder='Vía de transporte: 1 marítima, 4 aérea, 7 terrestre'
              />

              <div className='space-y-3 rounded-lg border p-3'>
                <p className='text-xs text-muted-foreground'>
                  Si se activa, al generar un Embarque de este tipo se envía la Solicitud
                  de Reserva (booking logístico). Solo aplica a Aéreo y Marítimo; Terrestre
                  no reserva espacio.
                </p>
                <form.Field name='requiereReserva'>
                  {(field) => (
                    <div className='flex items-center gap-3'>
                      <Switch
                        id='requiereReserva'
                        checked={!!field.state.value}
                        onCheckedChange={(v) => field.handleChange(v)}
                      />
                      <Label htmlFor='requiereReserva' className='font-medium'>Requiere Solicitud de Reserva</Label>
                    </div>
                  )}
                </form.Field>
              </div>

              {isEdit && (
                <div className='flex items-center gap-3'>
                  <form.Field name='bloqueado'>
                    {(field) => (
                      <Switch
                        id='bloqueado'
                        checked={!!field.state.value}
                        onCheckedChange={(v) => field.handleChange(v)}
                      />
                    )}
                  </form.Field>
                  <Label htmlFor='bloqueado' className='font-medium'>Bloqueado</Label>
                </div>
              )}
            </form.Form>
          </form.AppForm>
        </div>

        <SheetFooter>
          <Button type='button' variant='outline' onClick={() => handleOpenChange(false)}>Cancelar</Button>
          <Button type='submit' form='tipo-embarque-form' isLoading={isPending}>
            <Icons.check className='mr-1 h-4 w-4' />
            {isEdit ? 'Guardar cambios' : 'Crear tipo de embarque'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

export function TipoEmbarqueFormSheetTrigger() {
  const [open, setOpen] = useState(false)
  // Cada mantenedor tiene su propio permiso: ocultar "Nuevo" a perfiles sin
  // nivel TOTAL (el backend igual lo exige).
  const puedeEscribir = usePuedeEscribir('CONFIG_TIPOS_EMBARQUE')
  if (!puedeEscribir) return null
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Icons.add className='mr-2 h-4 w-4' />
        Nuevo tipo de embarque
      </Button>
      <TipoEmbarqueFormSheet open={open} onOpenChange={setOpen} />
    </>
  )
}
