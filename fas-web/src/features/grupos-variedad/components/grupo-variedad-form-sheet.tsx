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
import type { MantenedorSimple } from '@/features/mantenedor-simple/types'
import { EspecieQuickCreate } from '@/features/especies/components/especie-quick-create'

const grupoVariedadSchema = z.object({
  codigo: z.string().min(1, 'Requerido').max(50).trim(),
  descripcion: z.string().min(1, 'Requerido').max(200).trim(),
  descripcionExtranjera: z.string().max(200).trim().optional(),
  especieId: z.coerce.number().int().min(1, 'Selecciona una especie')
})

type GrupoVariedadFormValues = z.infer<typeof grupoVariedadSchema>

interface GrupoVariedadItem extends MantenedorSimple {
  especieId?: number
  especie?: { id: number; descripcion: string }
}

interface GrupoVariedadFormSheetProps {
  item?: GrupoVariedadItem
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function GrupoVariedadFormSheet({ item, open, onOpenChange }: GrupoVariedadFormSheetProps) {
  const isEdit = !!item
  const queryClient = useQueryClient()
  const mutations = createMantenedorMutations('grupos-variedad')
  const { keys } = createMantenedorQueries('grupos-variedad')
  const especiesQueries = createMantenedorQueries('especies')

  const { data: especiesData } = useQuery(especiesQueries.listOptions({ limit: 300, soloActivos: true }))
  const especies = especiesData?.data ?? []

  const createMutation = useMutation({
    ...mutations.create,
    onSuccess: () => {
      toast.success('Grupo de variedad creado correctamente')
      onOpenChange(false)
      form.reset()
      queryClient.invalidateQueries({ queryKey: keys.all })
    },
    onError: (e: Error) => toast.error(e.message || 'Error al crear el grupo de variedad')
  })

  const updateMutation = useMutation({
    ...mutations.update,
    onSuccess: () => {
      toast.success('Grupo de variedad actualizado correctamente')
      onOpenChange(false)
      queryClient.invalidateQueries({ queryKey: keys.all })
    },
    onError: (e: Error) => toast.error(e.message || 'Error al actualizar el grupo de variedad')
  })

  const form = useAppForm({
    defaultValues: {
      codigo: item?.codigo ?? '',
      descripcion: item?.descripcion ?? '',
      descripcionExtranjera: item?.descripcionExtranjera ?? '',
      especieId: item?.especieId ?? 0
    } as GrupoVariedadFormValues,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    validators: { onSubmit: grupoVariedadSchema as any },
    onSubmit: async ({ value }) => {
      if (isEdit) {
        await updateMutation.mutateAsync({ id: item.id, values: value })
      } else {
        await createMutation.mutateAsync(value)
      }
    }
  })

  const { FormTextField } = useFormFields<GrupoVariedadFormValues>()
  const isPending = createMutation.isPending || updateMutation.isPending

  const handleEspecieCreada = (especie: MantenedorSimple) => {
    form.setFieldValue('especieId', especie.id)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='flex flex-col sm:max-w-md'>
        <SheetHeader>
          <SheetTitle>{isEdit ? 'Editar Grupo de Variedad' : 'Nuevo Grupo de Variedad'}</SheetTitle>
          <SheetDescription>
            {isEdit ? 'Modifica los datos del grupo.' : 'Completa los datos para registrar un nuevo grupo de variedad.'}
          </SheetDescription>
        </SheetHeader>

        <div className='flex-1 overflow-auto py-2'>
          <form.AppForm>
            <form.Form id='grupo-variedad-form' className='space-y-4 px-1'>
              <FormTextField name='codigo' label='Código' required placeholder='Ej: UVA-MESA' disabled={isEdit} />
              <FormTextField name='descripcion' label='Descripción' required placeholder='Ej: Uva de Mesa' />
              <FormTextField name='descripcionExtranjera' label='Descripción extranjera' placeholder='Ej: Table Grape' />

              <form.Field name='especieId'>
                {(field) => (
                  <div className='space-y-1.5'>
                    <Label className='text-sm font-medium'>
                      Especie <span className='text-destructive'>*</span>
                    </Label>
                    <div className='flex gap-2'>
                      <Select
                        value={field.state.value ? String(field.state.value) : ''}
                        onValueChange={(v) => field.handleChange(parseInt(v, 10))}
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
            </form.Form>
          </form.AppForm>
        </div>

        <SheetFooter>
          <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type='submit' form='grupo-variedad-form' isLoading={isPending}>
            <Icons.check className='mr-1 h-4 w-4' />
            {isEdit ? 'Guardar cambios' : 'Crear grupo'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

export function GrupoVariedadFormSheetTrigger() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Icons.add className='mr-2 h-4 w-4' />
        Nuevo grupo de variedad
      </Button>
      <GrupoVariedadFormSheet open={open} onOpenChange={setOpen} />
    </>
  )
}
