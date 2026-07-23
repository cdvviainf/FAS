'use client'

import { useState } from 'react'
import { useStore } from '@tanstack/react-form'
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
import type { MantenedorSimple } from '@/features/mantenedor-simple/types'
import { EspecieQuickCreate } from '@/features/especies/components/especie-quick-create'

const variedadSchema = z.object({
  codigo: z.string().min(1, 'Requerido').max(50).trim(),
  descripcion: z.string().min(1, 'Requerido').max(200).trim(),
  descripcionExtranjera: z.string().max(200).trim().optional(),
  especieId: z.coerce.number().int().min(1, 'Selecciona una especie'),
  grupoVariedadId: z.coerce.number().int().positive().optional().nullable()
})

type VariedadFormValues = z.infer<typeof variedadSchema>

interface VariedadItem extends MantenedorSimple {
  especieId?: number
  grupoVariedadId?: number
  especie?: { id: number; descripcion: string }
  grupoVariedad?: { id: number; descripcion: string } | null
}

interface VariedadFormSheetProps {
  item?: VariedadItem
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function VariedadFormSheet({ item, open, onOpenChange }: VariedadFormSheetProps) {
  const isEdit = !!item
  const queryClient = useQueryClient()
  const mutations = createMantenedorMutations('variedades')
  const { keys } = createMantenedorQueries('variedades')
  const especiesQueries = createMantenedorQueries('especies')
  const gruposQueries = createMantenedorQueries('grupos-variedad')

  const { data: especiesData } = useQuery(especiesQueries.listOptions({ limit: 300 }))
  const especies = especiesData?.data ?? []

  const form = useAppForm({
    defaultValues: {
      codigo: item?.codigo ?? '',
      descripcion: item?.descripcion ?? '',
      descripcionExtranjera: item?.descripcionExtranjera ?? '',
      especieId: item?.especieId ?? 0,
      grupoVariedadId: item?.grupoVariedadId ?? null
    } as VariedadFormValues,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    validators: { onSubmit: variedadSchema as any },
    onSubmit: async ({ value }) => {
      if (isEdit) {
        await updateMutation.mutateAsync({ id: item.id, values: value })
      } else {
        await createMutation.mutateAsync(value)
      }
    }
  })

  // Watch especieId to filter gruposVariedad
  const selectedEspecieId = useStore(form.store, (s) => s.values.especieId)

  const { data: gruposData } = useQuery(
    gruposQueries.listOptions({ limit: 300, especieId: selectedEspecieId || undefined } as Parameters<typeof gruposQueries.listOptions>[0])
  )
  const grupos = gruposData?.data ?? []

  const createMutation = useMutation({
    ...mutations.create,
    onSuccess: () => {
      toast.success('Variedad creada correctamente')
      onOpenChange(false)
      form.reset()
      queryClient.invalidateQueries({ queryKey: keys.all })
    },
    onError: (e: Error) => toast.error(e.message || 'Error al crear la variedad')
  })

  const updateMutation = useMutation({
    ...mutations.update,
    onSuccess: () => {
      toast.success('Variedad actualizada correctamente')
      onOpenChange(false)
      queryClient.invalidateQueries({ queryKey: keys.all })
    },
    onError: (e: Error) => toast.error(e.message || 'Error al actualizar la variedad')
  })

  const { FormTextField } = useFormFields<VariedadFormValues>()
  const isPending = createMutation.isPending || updateMutation.isPending

  const handleEspecieCreada = (especie: MantenedorSimple) => {
    form.setFieldValue('especieId', especie.id)
    form.setFieldValue('grupoVariedadId', null)
  }

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
          <SheetTitle>{isEdit ? 'Editar Variedad' : 'Nueva Variedad'}</SheetTitle>
          <SheetDescription>
            {isEdit ? 'Modifica los datos de la variedad.' : 'Completa los datos para registrar una nueva variedad.'}
          </SheetDescription>
        </SheetHeader>

        <div className='flex-1 overflow-auto py-2'>
          <form.AppForm>
            <form.Form id='variedad-form' className='space-y-4 px-1'>
              <FormTextField name='codigo' label='Código' required placeholder='Ej: RG-SEE' disabled={isEdit} />
              <FormTextField name='descripcion' label='Descripción' required placeholder='Ej: Red Globe Seedless' />
              <FormTextField name='descripcionExtranjera' label='Descripción extranjera' placeholder='Ej: Red Globe Seedless' />

              <form.Field name='especieId'>
                {(field) => (
                  <div className='space-y-1.5'>
                    <Label className='text-sm font-medium'>
                      Especie <span className='text-destructive'>*</span>
                    </Label>
                    <div className='flex gap-2'>
                      <Select
                        value={field.state.value ? String(field.state.value) : ''}
                        onValueChange={(v) => {
                          field.handleChange(parseInt(v, 10))
                          form.setFieldValue('grupoVariedadId', null)
                        }}
                      >
                        <SelectTrigger className='flex-1'>
                          <SelectValue placeholder='Seleccionar especie...' />
                        </SelectTrigger>
                        <SelectContent>
                          {especies.map((e) => (
                            <SelectItem key={e.id} value={String(e.id)}>
                              {e.descripcion}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <EspecieQuickCreate onCreated={handleEspecieCreada} />
                    </div>
                    {field.state.meta.errors.length > 0 && (
                      <p className='text-sm text-destructive'>{String(field.state.meta.errors[0])}</p>
                    )}
                  </div>
                )}
              </form.Field>

              <form.Field name='grupoVariedadId'>
                {(field) => (
                  <div className='space-y-1.5'>
                    <Label className='text-sm font-medium'>Grupo de Variedad</Label>
                    <Select
                      value={field.state.value ? String(field.state.value) : ''}
                      onValueChange={(v) => field.handleChange(v ? parseInt(v, 10) : null)}
                      disabled={!selectedEspecieId}
                    >
                      <SelectTrigger className='flex-1'>
                        <SelectValue placeholder={selectedEspecieId ? 'Sin grupo (opcional)...' : 'Selecciona una especie primero'} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value=''>Sin grupo</SelectItem>
                        {grupos.map((g) => (
                          <SelectItem key={g.id} value={String(g.id)}>
                            {g.descripcion}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </form.Field>
            </form.Form>
          </form.AppForm>
        </div>

        <SheetFooter>
          <Button type='button' variant='outline' onClick={() => handleOpenChange(false)}>Cancelar</Button>
          <Button type='submit' form='variedad-form' isLoading={isPending}>
            <Icons.check className='mr-1 h-4 w-4' />
            {isEdit ? 'Guardar cambios' : 'Crear variedad'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

export function VariedadFormSheetTrigger() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Icons.add className='mr-2 h-4 w-4' />
        Nueva variedad
      </Button>
      <VariedadFormSheet open={open} onOpenChange={setOpen} />
    </>
  )
}
