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
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { z } from 'zod'
import { createMantenedorMutations } from '@/features/mantenedor-simple/mutations'
import { createMantenedorQueries } from '@/features/mantenedor-simple/queries'
import { createCodigoValidator } from '@/features/mantenedor-simple/service'
import type { MantenedorSimple } from '@/features/mantenedor-simple/types'

const conceptoSchema = z.object({
  codigo: z.string().min(1, 'Requerido').max(50).trim(),
  descripcion: z.string().min(1, 'Requerido').max(200).trim(),
  descripcionExtranjera: z.string().max(200).trim().optional(),
  naturaleza: z.enum(['DEBE', 'HABER', 'AMBOS']),
})

type ConceptoFormValues = z.infer<typeof conceptoSchema>

interface ConceptoItem extends MantenedorSimple {
  naturaleza?: 'DEBE' | 'HABER' | 'AMBOS'
}

interface ConceptoFormSheetProps {
  item?: ConceptoItem
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ConceptoCtaCteFormSheet({ item, open, onOpenChange }: ConceptoFormSheetProps) {
  const isEdit = !!item
  const queryClient = useQueryClient()
  const mutations = createMantenedorMutations('conceptos-cta-cte')
  const { keys } = createMantenedorQueries('conceptos-cta-cte')
  const codigoValidator = useMemo(() => createCodigoValidator('conceptos-cta-cte'), [])

  const form = useAppForm({
    defaultValues: {
      codigo: item?.codigo ?? '',
      descripcion: item?.descripcion ?? '',
      descripcionExtranjera: item?.descripcionExtranjera ?? '',
      naturaleza: item?.naturaleza ?? 'AMBOS',
    } as ConceptoFormValues,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    validators: { onSubmit: conceptoSchema as any },
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
      toast.success('Concepto creado correctamente')
      onOpenChange(false)
      form.reset()
      queryClient.invalidateQueries({ queryKey: keys.all })
    },
    onError: (e: Error) => toast.error(e.message || 'Error al crear el concepto')
  })

  const updateMutation = useMutation({
    ...mutations.update,
    onSuccess: () => {
      toast.success('Concepto actualizado correctamente')
      onOpenChange(false)
      queryClient.invalidateQueries({ queryKey: keys.all })
    },
    onError: (e: Error) => toast.error(e.message || 'Error al actualizar el concepto')
  })

  const { FormTextField } = useFormFields<ConceptoFormValues>()
  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='flex flex-col sm:max-w-md'>
        <SheetHeader>
          <SheetTitle>{isEdit ? 'Editar Concepto' : 'Nuevo Concepto Cta. Cte.'}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? 'Modifica los datos del concepto de cuenta corriente.'
              : 'Registra un nuevo concepto para la cuenta corriente del productor.'}
          </SheetDescription>
        </SheetHeader>

        <div className='flex-1 overflow-auto py-2'>
          <form.AppForm>
            <form.Form id='concepto-form' className='space-y-4 px-1'>
              <FormTextField name='codigo' label='Código' required placeholder='Ej: ANTICIPO' disabled={isEdit} validators={isEdit ? undefined : codigoValidator} />
              <FormTextField name='descripcion' label='Descripción' required placeholder='Ej: Anticipo de Compra' />
              <FormTextField name='descripcionExtranjera' label='Descripción extranjera' placeholder='Ej: Purchase Advance' />

              <form.Field name='naturaleza'>
                {(field) => (
                  <div className='space-y-1.5'>
                    <Label className='text-sm font-medium'>
                      Naturaleza <span className='text-destructive'>*</span>
                    </Label>
                    <Select
                      value={field.state.value ?? ''}
                      onValueChange={(v) => field.handleChange(v as 'DEBE' | 'HABER' | 'AMBOS')}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder='Seleccionar naturaleza...' />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='DEBE'>Debe — cargo a la cuenta del productor</SelectItem>
                        <SelectItem value='HABER'>Haber — abono a la cuenta del productor</SelectItem>
                        <SelectItem value='AMBOS'>Ambos — puede ser cargo o abono</SelectItem>
                      </SelectContent>
                    </Select>
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
          <Button type='submit' form='concepto-form' isLoading={isPending}>
            <Icons.check className='mr-1 h-4 w-4' />
            {isEdit ? 'Guardar cambios' : 'Crear concepto'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

export function ConceptoCtaCteFormSheetTrigger() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Icons.add className='mr-2 h-4 w-4' />
        Nuevo concepto
      </Button>
      <ConceptoCtaCteFormSheet open={open} onOpenChange={setOpen} />
    </>
  )
}
