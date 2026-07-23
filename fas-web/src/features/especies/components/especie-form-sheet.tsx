'use client'

import { useState, useMemo } from 'react'
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
import { createCodigoValidator } from '@/features/mantenedor-simple/service'
import type { MantenedorSimple } from '@/features/mantenedor-simple/types'
import { UnidadMedidaQuickCreate } from '@/features/unidades-medida/components/unidad-medida-quick-create'

const especieSchema = z.object({
  codigo: z.string().min(1, 'Requerido').max(50).trim(),
  descripcion: z.string().min(1, 'Requerido').max(200).trim(),
  descripcionExtranjera: z.string().max(200).trim().optional(),
  unidadMedidaCalidadId: z.coerce.number().int().min(0).optional(),
  bloqueado: z.boolean(),
})

type EspecieFormValues = z.infer<typeof especieSchema>

interface EspecieItem extends MantenedorSimple {
  unidadMedidaCalidadId?: number | null
  unidadMedidaCalidad?: { id: number; descripcion: string; codigo: string }
}

interface EspecieFormSheetProps {
  item?: EspecieItem
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EspecieFormSheet({ item, open, onOpenChange }: EspecieFormSheetProps) {
  const isEdit = !!item
  const queryClient = useQueryClient()
  const mutations = createMantenedorMutations('especies')
  const { keys } = createMantenedorQueries('especies')
  const codigoValidator = useMemo(() => createCodigoValidator('especies'), [])

  const umQueries = createMantenedorQueries('unidades-medida')
  const { data: umData } = useQuery(umQueries.listOptions({ limit: 200, soloActivos: true }))
  const unidades = umData?.data ?? []

  const form = useAppForm({
    defaultValues: {
      codigo: item?.codigo ?? '',
      descripcion: item?.descripcion ?? '',
      descripcionExtranjera: item?.descripcionExtranjera ?? '',
      unidadMedidaCalidadId: item?.unidadMedidaCalidadId ?? 0,
      bloqueado: item?.bloqueado ?? false,
    } as EspecieFormValues,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    validators: { onSubmit: especieSchema as any },
    onSubmit: async ({ value }) => {
      const payload = {
        ...value,
        // 0 = "Sin asignar": enviar null para limpiar FK existente
        unidadMedidaCalidadId: value.unidadMedidaCalidadId || null,
      }
      if (isEdit) {
        await updateMutation.mutateAsync({ id: item.id, values: payload })
      } else {
        await createMutation.mutateAsync(payload)
      }
    }
  })

  const createMutation = useMutation({
    ...mutations.create,
    onSuccess: () => {
      toast.success('Especie creada correctamente')
      onOpenChange(false)
      form.reset()
      queryClient.invalidateQueries({ queryKey: keys.all })
    },
    onError: (e: Error) => toast.error(e.message || 'Error al crear la especie')
  })

  const updateMutation = useMutation({
    ...mutations.update,
    onSuccess: () => {
      toast.success('Especie actualizada correctamente')
      onOpenChange(false)
      queryClient.invalidateQueries({ queryKey: keys.all })
    },
    onError: (e: Error) => toast.error(e.message || 'Error al actualizar la especie')
  })

  const { FormTextField, FormSwitchField } = useFormFields<EspecieFormValues>()
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
          <SheetTitle>{isEdit ? 'Editar Especie' : 'Nueva Especie'}</SheetTitle>
          <SheetDescription>
            {isEdit ? 'Modifica los datos de la especie.' : 'Registra una nueva especie frutera.'}
          </SheetDescription>
        </SheetHeader>

        <div className='flex-1 overflow-auto py-2'>
          <form.AppForm>
            <form.Form id='especie-form' className='space-y-4 px-1'>
              <FormTextField
                name='codigo'
                label='Código'
                required
                placeholder='Ej: UVA'
                disabled={isEdit}
                validators={isEdit ? undefined : codigoValidator}
              />
              <FormTextField
                name='descripcion'
                label='Descripción'
                required
                placeholder='Ej: Uva de Mesa'
              />
              <FormTextField
                name='descripcionExtranjera'
                label='Descripción extranjera'
                placeholder='Ej: Table Grape'
              />

              <form.Field name='unidadMedidaCalidadId'>
                {(field) => (
                  <div className='space-y-1.5'>
                    <Label className='text-sm font-medium'>Unidad de medida de calidad</Label>
                    <div className='flex gap-2'>
                      <Select
                        value={field.state.value ? String(field.state.value) : ''}
                        onValueChange={(v) => field.handleChange(v ? parseInt(v, 10) : 0)}
                      >
                        <SelectTrigger className='flex-1'>
                          <SelectValue placeholder='Sin unidad de medida...' />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value='0'>
                            <span className='text-muted-foreground'>— Sin asignar —</span>
                          </SelectItem>
                          {unidades.map((u) => (
                            <SelectItem key={u.id} value={String(u.id)}>
                              <span className='font-mono text-xs mr-2 text-muted-foreground'>{u.codigo}</span>
                              {u.descripcion}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <UnidadMedidaQuickCreate onCreated={(u) => field.handleChange(u.id)} />
                    </div>
                  </div>
                )}
              </form.Field>

              {isEdit && (
                <FormSwitchField
                  name='bloqueado'
                  label='Bloqueado'
                  description='Una especie bloqueada no aparece en los selectores de nuevos registros.'
                />
              )}
            </form.Form>
          </form.AppForm>
        </div>

        <SheetFooter>
          <Button type='button' variant='outline' onClick={() => handleOpenChange(false)}>Cancelar</Button>
          <Button type='submit' form='especie-form' isLoading={isPending}>
            <Icons.check className='mr-1 h-4 w-4' />
            {isEdit ? 'Guardar cambios' : 'Crear especie'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

export function EspecieFormSheetTrigger() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Icons.add className='mr-2 h-4 w-4' />
        Nueva especie
      </Button>
      <EspecieFormSheet open={open} onOpenChange={setOpen} />
    </>
  )
}
