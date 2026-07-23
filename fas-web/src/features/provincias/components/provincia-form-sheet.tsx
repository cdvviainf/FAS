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
import { RegionQuickCreate } from '@/features/regiones/components/region-quick-create'

const provinciaSchema = z.object({
  codigo: z.string().min(1, 'Requerido').max(50).trim(),
  descripcion: z.string().min(1, 'Requerido').max(200).trim(),
  descripcionExtranjera: z.string().max(200).trim().optional(),
  regionId: z.coerce.number().int().min(1, 'Selecciona una región')
})

type ProvinciaFormValues = z.infer<typeof provinciaSchema>

interface ProvinciaFormSheetProps {
  item?: MantenedorSimple & { regionId?: number; region?: { id: number; descripcion: string } }
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ProvinciaFormSheet({ item, open, onOpenChange }: ProvinciaFormSheetProps) {
  const isEdit = !!item
  const queryClient = useQueryClient()
  const mutations = createMantenedorMutations('provincias')
  const { keys } = createMantenedorQueries('provincias')
  const regionesQueries = createMantenedorQueries('regiones')

  const { data: regionesData } = useQuery(regionesQueries.listOptions({ limit: 300, soloActivos: true }))
  const regiones = regionesData?.data ?? []

  const createMutation = useMutation({
    ...mutations.create,
    onSuccess: () => {
      toast.success('Provincia creada correctamente')
      onOpenChange(false)
      form.reset()
      queryClient.invalidateQueries({ queryKey: keys.all })
    },
    onError: (e: Error) => toast.error(e.message || 'Error al crear la provincia')
  })

  const updateMutation = useMutation({
    ...mutations.update,
    onSuccess: () => {
      toast.success('Provincia actualizada correctamente')
      onOpenChange(false)
      queryClient.invalidateQueries({ queryKey: keys.all })
    },
    onError: (e: Error) => toast.error(e.message || 'Error al actualizar la provincia')
  })

  const form = useAppForm({
    defaultValues: {
      codigo: item?.codigo ?? '',
      descripcion: item?.descripcion ?? '',
      descripcionExtranjera: item?.descripcionExtranjera ?? '',
      regionId: item?.regionId ?? 0
    } as ProvinciaFormValues,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    validators: { onSubmit: provinciaSchema as any },
    onSubmit: async ({ value }) => {
      if (isEdit) {
        await updateMutation.mutateAsync({ id: item.id, values: value })
      } else {
        await createMutation.mutateAsync(value)
      }
    }
  })

  const { FormTextField } = useFormFields<ProvinciaFormValues>()
  const isPending = createMutation.isPending || updateMutation.isPending

  const handleRegionCreada = (region: MantenedorSimple) => {
    form.setFieldValue('regionId', region.id)
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
          <SheetTitle>{isEdit ? 'Editar Provincia' : 'Nueva Provincia'}</SheetTitle>
          <SheetDescription>
            {isEdit ? 'Modifica los datos de la provincia.' : 'Completa los datos para registrar una nueva provincia.'}
          </SheetDescription>
        </SheetHeader>

        <div className='flex-1 overflow-auto py-2'>
          <form.AppForm>
            <form.Form id='provincia-form' className='space-y-4 px-1'>
              <FormTextField name='codigo' label='Código' required placeholder='Ej: RM-01' disabled={isEdit} />
              <FormTextField name='descripcion' label='Descripción' required placeholder='Ej: Santiago' />
              <FormTextField name='descripcionExtranjera' label='Descripción extranjera' placeholder='Ej: Santiago' />

              <form.Field name='regionId'>
                {(field) => (
                  <div className='space-y-1.5'>
                    <Label className='text-sm font-medium'>
                      Región <span className='text-destructive'>*</span>
                    </Label>
                    <div className='flex gap-2'>
                      <Select
                        value={field.state.value ? String(field.state.value) : ''}
                        onValueChange={(v) => field.handleChange(parseInt(v, 10))}
                      >
                        <SelectTrigger className='flex-1'>
                          <SelectValue placeholder='Seleccionar región...' />
                        </SelectTrigger>
                        <SelectContent>
                          {regiones.map((r) => (
                            <SelectItem key={r.id} value={String(r.id)}>
                              {r.descripcion}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <RegionQuickCreate onCreated={handleRegionCreada} />
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
          <Button type='button' variant='outline' onClick={() => handleOpenChange(false)}>Cancelar</Button>
          <Button type='submit' form='provincia-form' isLoading={isPending}>
            <Icons.check className='mr-1 h-4 w-4' />
            {isEdit ? 'Guardar cambios' : 'Crear provincia'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

export function ProvinciaFormSheetTrigger() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Icons.add className='mr-2 h-4 w-4' />
        Nueva provincia
      </Button>
      <ProvinciaFormSheet open={open} onOpenChange={setOpen} />
    </>
  )
}
