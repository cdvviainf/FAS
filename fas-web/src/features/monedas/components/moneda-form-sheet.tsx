'use client'

import { useState, useMemo } from 'react'
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
import { createCodigoValidator } from '@/features/mantenedor-simple/service'
import type { MantenedorSimple } from '@/features/mantenedor-simple/types'

const monedaSchema = z.object({
  codigo: z
    .string()
    .length(3, 'El código debe ser ISO 4217 (3 letras mayúsculas)')
    .regex(/^[A-Z]{3}$/, 'Solo letras mayúsculas, ej: CLP, USD, EUR')
    .trim(),
  descripcion: z.string().min(1, 'Requerido').max(200).trim(),
  descripcionExtranjera: z.string().max(200).trim().optional(),
  esMonedaBase: z.boolean(),
  decimales: z.number().int().min(0).max(6),
})

type MonedaFormValues = z.infer<typeof monedaSchema>

interface MonedaItem extends MantenedorSimple {
  esMonedaBase?: boolean
  decimales?: number
}

interface MonedaFormSheetProps {
  item?: MonedaItem
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MonedaFormSheet({ item, open, onOpenChange }: MonedaFormSheetProps) {
  const isEdit = !!item
  const queryClient = useQueryClient()
  const mutations = createMantenedorMutations('monedas')
  const { keys } = createMantenedorQueries('monedas')
  const codigoValidator = useMemo(() => createCodigoValidator('monedas'), [])

  const form = useAppForm({
    defaultValues: {
      codigo: item?.codigo ?? '',
      descripcion: item?.descripcion ?? '',
      descripcionExtranjera: item?.descripcionExtranjera ?? '',
      esMonedaBase: item?.esMonedaBase ?? false,
      decimales: item?.decimales ?? 2,
    } as MonedaFormValues,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    validators: { onSubmit: monedaSchema as any },
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
      toast.success('Moneda creada correctamente')
      onOpenChange(false)
      form.reset()
      queryClient.invalidateQueries({ queryKey: keys.all })
    },
    onError: (e: Error) => toast.error(e.message || 'Error al crear la moneda')
  })

  const updateMutation = useMutation({
    ...mutations.update,
    onSuccess: () => {
      toast.success('Moneda actualizada correctamente')
      onOpenChange(false)
      queryClient.invalidateQueries({ queryKey: keys.all })
    },
    onError: (e: Error) => toast.error(e.message || 'Error al actualizar la moneda')
  })

  const { FormTextField } = useFormFields<MonedaFormValues>()
  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='flex flex-col sm:max-w-md'>
        <SheetHeader>
          <SheetTitle>{isEdit ? 'Editar Moneda' : 'Nueva Moneda'}</SheetTitle>
          <SheetDescription>
            {isEdit ? 'Modifica los datos de la moneda.' : 'Registra una nueva moneda (código ISO 4217).'}
          </SheetDescription>
        </SheetHeader>

        <div className='flex-1 overflow-auto py-2'>
          <form.AppForm>
            <form.Form id='moneda-form' className='space-y-4 px-1'>
              <FormTextField
                name='codigo'
                label='Código ISO 4217'
                required
                placeholder='Ej: CLP'
                disabled={isEdit}
                validators={isEdit ? undefined : codigoValidator}
              />
              <FormTextField name='descripcion' label='Descripción' required placeholder='Ej: Peso Chileno' />
              <FormTextField name='descripcionExtranjera' label='Descripción extranjera' placeholder='Ej: Chilean Peso' />
              <FormTextField name='decimales' label='Decimales' placeholder='0–6' type='number' />

              <form.Field name='esMonedaBase'>
                {(field) => (
                  <div className='flex items-center gap-3 rounded-lg border p-3'>
                    <Switch
                      id='esMonedaBase'
                      checked={!!field.state.value}
                      onCheckedChange={(v) => field.handleChange(v)}
                    />
                    <div>
                      <Label htmlFor='esMonedaBase' className='font-medium'>Moneda base</Label>
                      <p className='text-xs text-muted-foreground'>
                        Activa esta opción para designar la moneda base del sistema (R5). Solo puede haber una.
                      </p>
                    </div>
                  </div>
                )}
              </form.Field>
            </form.Form>
          </form.AppForm>
        </div>

        <SheetFooter>
          <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type='submit' form='moneda-form' isLoading={isPending}>
            <Icons.check className='mr-1 h-4 w-4' />
            {isEdit ? 'Guardar cambios' : 'Crear moneda'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

export function MonedaFormSheetTrigger() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Icons.add className='mr-2 h-4 w-4' />
        Nueva moneda
      </Button>
      <MonedaFormSheet open={open} onOpenChange={setOpen} />
    </>
  )
}
