'use client'

import { useState } from 'react'
import { useAppForm, useFormFields } from '@/components/ui/tanstack-form'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Icons } from '@/components/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { z } from 'zod'
import { createMantenedorMutations } from '@/features/mantenedor-simple/mutations'
import { createMantenedorQueries } from '@/features/mantenedor-simple/queries'
import { usePuedeEscribir } from '@/hooks/use-item-acceso'
import type { MantenedorSimple } from '@/features/mantenedor-simple/types'

const grupoDefectoSchema = z.object({
  codigo: z.string().min(1, 'Requerido').max(50).trim(),
  descripcion: z.string().min(1, 'Requerido').max(200).trim(),
  descripcionExtranjera: z.string().max(200).trim().optional(),
  tipoDefectoId: z.coerce.number().int().min(1, 'Selecciona un tipo de defecto'),
  bloqueado: z.boolean().optional()
})

type GrupoDefectoFormValues = z.infer<typeof grupoDefectoSchema>

interface GrupoDefectoItem extends MantenedorSimple {
  tipoDefectoId?: number
  tipoDefecto?: { id: number; descripcion: string }
}

interface GrupoDefectoFormSheetProps {
  item?: GrupoDefectoItem
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function GrupoDefectoFormSheet({ item, open, onOpenChange }: GrupoDefectoFormSheetProps) {
  const isEdit = !!item
  const queryClient = useQueryClient()
  const mutations = createMantenedorMutations('grupos-defecto')
  const { keys } = createMantenedorQueries('grupos-defecto')
  const tiposDefectoQueries = createMantenedorQueries('tipos-defecto')

  const { data: tiposDefectoData } = useQuery(tiposDefectoQueries.listOptions({ limit: 300, soloActivos: true }))
  const tiposDefecto = tiposDefectoData?.data ?? []

  const createMutation = useMutation({
    ...mutations.create,
    onSuccess: () => {
      toast.success('Grupo de defecto creado correctamente')
      onOpenChange(false)
      form.reset()
      queryClient.invalidateQueries({ queryKey: keys.all })
    },
    onError: (e: Error) => toast.error(e.message || 'Error al crear el grupo de defecto')
  })

  const updateMutation = useMutation({
    ...mutations.update,
    onSuccess: () => {
      toast.success('Grupo de defecto actualizado correctamente')
      onOpenChange(false)
      queryClient.invalidateQueries({ queryKey: keys.all })
    },
    onError: (e: Error) => toast.error(e.message || 'Error al actualizar el grupo de defecto')
  })

  const form = useAppForm({
    defaultValues: {
      codigo: item?.codigo ?? '',
      descripcion: item?.descripcion ?? '',
      descripcionExtranjera: item?.descripcionExtranjera ?? '',
      tipoDefectoId: item?.tipoDefectoId ?? 0,
      bloqueado: item?.bloqueado ?? false
    } as GrupoDefectoFormValues,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    validators: { onSubmit: grupoDefectoSchema as any },
    onSubmit: async ({ value }) => {
      if (isEdit) {
        await updateMutation.mutateAsync({ id: item.id, values: value })
      } else {
        await createMutation.mutateAsync(value)
      }
    }
  })

  const { FormTextField, FormSwitchField } = useFormFields<GrupoDefectoFormValues>()
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
          <SheetTitle>{isEdit ? 'Editar Grupo de Defecto' : 'Nuevo Grupo de Defecto'}</SheetTitle>
          <SheetDescription>
            {isEdit ? 'Modifica los datos del grupo.' : 'Completa los datos para registrar un nuevo grupo de defecto.'}
          </SheetDescription>
        </SheetHeader>

        <div className='flex-1 overflow-auto py-2'>
          <form.AppForm>
            <form.Form id='grupo-defecto-form' className='space-y-4 px-1'>
              <FormTextField name='codigo' label='Código' required placeholder='Ej: CALIDAD' disabled={isEdit} />
              <FormTextField name='descripcion' label='Descripción' required placeholder='Ej: Calidad' />
              <FormTextField name='descripcionExtranjera' label='Descripción extranjera' placeholder='Ej: Quality' />

              <form.Field name='tipoDefectoId'>
                {(field) => (
                  <div className='space-y-1.5'>
                    <Label className='text-sm font-medium'>
                      Tipo de Defecto <span className='text-destructive'>*</span>
                    </Label>
                    <Select
                      value={field.state.value ? String(field.state.value) : ''}
                      onValueChange={(v) => field.handleChange(parseInt(v, 10))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder='Seleccionar tipo de defecto...' />
                      </SelectTrigger>
                      <SelectContent>
                        {tiposDefecto.map((t) => (
                          <SelectItem key={t.id} value={String(t.id)}>
                            {t.descripcion}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {field.state.meta.errors.length > 0 && (
                      <p className='text-sm text-destructive'>{String(field.state.meta.errors[0])}</p>
                    )}
                  </div>
                )}
              </form.Field>

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
          <Button type='button' variant='outline' onClick={() => handleOpenChange(false)}>Cancelar</Button>
          <Button type='submit' form='grupo-defecto-form' isLoading={isPending}>
            <Icons.check className='mr-1 h-4 w-4' />
            {isEdit ? 'Guardar cambios' : 'Crear grupo'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

export function GrupoDefectoFormSheetTrigger() {
  const [open, setOpen] = useState(false)
  const puedeEscribir = usePuedeEscribir('CONFIG_MANTENEDORES')
  if (!puedeEscribir) return null
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Icons.add className='mr-2 h-4 w-4' />
        Nuevo grupo de defecto
      </Button>
      <GrupoDefectoFormSheet open={open} onOpenChange={setOpen} />
    </>
  )
}
