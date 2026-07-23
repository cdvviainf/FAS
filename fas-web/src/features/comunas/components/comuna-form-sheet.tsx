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
import { ProvinciaQuickCreate } from '@/features/provincias/components/provincia-quick-create'

const comunaSchema = z.object({
  codigo: z.string().min(1, 'Requerido').max(50).trim(),
  descripcion: z.string().min(1, 'Requerido').max(200).trim(),
  descripcionExtranjera: z.string().max(200).trim().optional(),
  provinciaId: z.coerce.number().int().min(1, 'Selecciona una provincia')
})

type ComunaFormValues = z.infer<typeof comunaSchema>

interface ComunaItem extends MantenedorSimple {
  provinciaId?: number
  provincia?: { id: number; descripcion: string; region?: { id: number; descripcion: string } }
}

interface ComunaFormSheetProps {
  item?: ComunaItem
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ComunaFormSheet({ item, open, onOpenChange }: ComunaFormSheetProps) {
  const isEdit = !!item
  const queryClient = useQueryClient()
  const mutations = createMantenedorMutations('comunas')
  const { keys } = createMantenedorQueries('comunas')
  const provinciasQueries = createMantenedorQueries('provincias')

  const { data: provinciasData } = useQuery(provinciasQueries.listOptions({ limit: 300, soloActivos: true }))
  // Provincias come with region included from the API
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const provincias = (provinciasData?.data ?? []) as any[]

  const createMutation = useMutation({
    ...mutations.create,
    onSuccess: () => {
      toast.success('Comuna creada correctamente')
      onOpenChange(false)
      form.reset()
      queryClient.invalidateQueries({ queryKey: keys.all })
    },
    onError: (e: Error) => toast.error(e.message || 'Error al crear la comuna')
  })

  const updateMutation = useMutation({
    ...mutations.update,
    onSuccess: () => {
      toast.success('Comuna actualizada correctamente')
      onOpenChange(false)
      queryClient.invalidateQueries({ queryKey: keys.all })
    },
    onError: (e: Error) => toast.error(e.message || 'Error al actualizar la comuna')
  })

  const form = useAppForm({
    defaultValues: {
      codigo: item?.codigo ?? '',
      descripcion: item?.descripcion ?? '',
      descripcionExtranjera: item?.descripcionExtranjera ?? '',
      provinciaId: item?.provinciaId ?? 0
    } as ComunaFormValues,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    validators: { onSubmit: comunaSchema as any },
    onSubmit: async ({ value }) => {
      if (isEdit) {
        await updateMutation.mutateAsync({ id: item.id, values: value })
      } else {
        await createMutation.mutateAsync(value)
      }
    }
  })

  const { FormTextField } = useFormFields<ComunaFormValues>()
  const isPending = createMutation.isPending || updateMutation.isPending

  const handleProvinciaCreada = (provincia: MantenedorSimple) => {
    form.setFieldValue('provinciaId', provincia.id)
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
          <SheetTitle>{isEdit ? 'Editar Comuna' : 'Nueva Comuna'}</SheetTitle>
          <SheetDescription>
            {isEdit ? 'Modifica los datos de la comuna.' : 'Completa los datos para registrar una nueva comuna.'}
          </SheetDescription>
        </SheetHeader>

        <div className='flex-1 overflow-auto py-2'>
          <form.AppForm>
            <form.Form id='comuna-form' className='space-y-4 px-1'>
              <FormTextField name='codigo' label='Código' required placeholder='Ej: STGO-01' disabled={isEdit} />
              <FormTextField name='descripcion' label='Descripción' required placeholder='Ej: Santiago' />
              <FormTextField name='descripcionExtranjera' label='Descripción extranjera' placeholder='Ej: Santiago' />

              <form.Field name='provinciaId'>
                {(field) => (
                  <div className='space-y-1.5'>
                    <Label className='text-sm font-medium'>
                      Provincia <span className='text-destructive'>*</span>
                    </Label>
                    <div className='flex gap-2'>
                      <Select
                        value={field.state.value ? String(field.state.value) : ''}
                        onValueChange={(v) => field.handleChange(parseInt(v, 10))}
                      >
                        <SelectTrigger className='flex-1'>
                          <SelectValue placeholder='Seleccionar provincia...' />
                        </SelectTrigger>
                        <SelectContent>
                          {provincias.map((p) => (
                            <SelectItem key={p.id} value={String(p.id)}>
                              <span className='text-muted-foreground text-xs mr-2'>{p.region?.descripcion ?? ''} &rsaquo;</span>
                              {p.descripcion}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <ProvinciaQuickCreate onCreated={handleProvinciaCreada} />
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
          <Button type='submit' form='comuna-form' isLoading={isPending}>
            <Icons.check className='mr-1 h-4 w-4' />
            {isEdit ? 'Guardar cambios' : 'Crear comuna'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

export function ComunaFormSheetTrigger() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Icons.add className='mr-2 h-4 w-4' />
        Nueva comuna
      </Button>
      <ComunaFormSheet open={open} onOpenChange={setOpen} />
    </>
  )
}
