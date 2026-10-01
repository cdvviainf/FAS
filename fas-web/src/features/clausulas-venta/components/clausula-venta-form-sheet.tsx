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

// Extraída de Parametro (2026-09-30, decisión de negocio): mantenedor propio,
// sin Tipo de Parámetro — solo código/descripción + los flags que determinan
// si al facturar/proformar con esta cláusula se exige Flete y/o Seguro.
const clausulaVentaSchema = z.object({
  codigo: z.string().min(1, 'Requerido').max(50).trim(),
  descripcion: z.string().min(1, 'Requerido').max(200).trim(),
  descripcionExtranjera: z.string().max(200).trim().optional(),
  codigoAduana: z.string().max(20).trim().optional(),
  requiereFlete: z.boolean(),
  requiereSeguro: z.boolean()
})

type ClausulaVentaFormValues = z.infer<typeof clausulaVentaSchema>

interface ClausulaVentaItem extends MantenedorSimple {
  requiereFlete?: boolean
  requiereSeguro?: boolean
  codigoAduana?: string | null
}

interface ClausulaVentaFormSheetProps {
  item?: ClausulaVentaItem
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ClausulaVentaFormSheet({ item, open, onOpenChange }: ClausulaVentaFormSheetProps) {
  const isEdit = !!item
  const queryClient = useQueryClient()
  const mutations = createMantenedorMutations('clausulas-venta')
  const { keys } = createMantenedorQueries('clausulas-venta')

  const createMutation = useMutation({
    ...mutations.create,
    onSuccess: () => {
      toast.success('Cláusula de Venta creada correctamente')
      onOpenChange(false)
      form.reset()
      queryClient.invalidateQueries({ queryKey: keys.all })
    },
    onError: (e: Error) => toast.error(e.message || 'Error al crear la cláusula de venta')
  })

  const updateMutation = useMutation({
    ...mutations.update,
    onSuccess: () => {
      toast.success('Cláusula de Venta actualizada correctamente')
      onOpenChange(false)
      queryClient.invalidateQueries({ queryKey: keys.all })
    },
    onError: (e: Error) => toast.error(e.message || 'Error al actualizar la cláusula de venta')
  })

  const form = useAppForm({
    defaultValues: {
      codigo: item?.codigo ?? '',
      descripcion: item?.descripcion ?? '',
      descripcionExtranjera: item?.descripcionExtranjera ?? '',
      codigoAduana: item?.codigoAduana ?? '',
      requiereFlete: item?.requiereFlete ?? false,
      requiereSeguro: item?.requiereSeguro ?? false
    } as ClausulaVentaFormValues,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    validators: { onSubmit: clausulaVentaSchema as any },
    onSubmit: async ({ value }) => {
      if (isEdit) {
        await updateMutation.mutateAsync({ id: item.id, values: value })
      } else {
        await createMutation.mutateAsync(value)
      }
    }
  })

  const { FormTextField } = useFormFields<ClausulaVentaFormValues>()
  const isPending = createMutation.isPending || updateMutation.isPending

  // El Sheet permanece montado entre aperturas (lo controla el padre vía `open`),
  // asi que hay que resetear el form manualmente al cerrar (Cancelar, Escape, click afuera);
  // si no, reabrir "Nueva" muestra los valores tipeados en la sesion anterior.
  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) form.reset()
    onOpenChange(nextOpen)
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className='flex flex-col sm:max-w-md'>
        <SheetHeader>
          <SheetTitle>{isEdit ? 'Editar Cláusula de Venta' : 'Nueva Cláusula de Venta'}</SheetTitle>
          <SheetDescription>
            {isEdit ? 'Modifica los datos de la cláusula de venta (Incoterm).' : 'Completa los datos para registrar una nueva cláusula de venta (Incoterm).'}
          </SheetDescription>
        </SheetHeader>

        <div className='flex-1 overflow-auto py-2'>
          <form.AppForm>
            <form.Form id='clausula-venta-form' className='space-y-4 px-1'>
              <FormTextField name='codigo' label='Código' required placeholder='Ej: CIF' disabled={isEdit} />
              <FormTextField name='descripcion' label='Descripción' required placeholder='Ej: Costo, Seguro y Flete' />
              <FormTextField name='descripcionExtranjera' label='Descripción extranjera' placeholder='Ej: Cost, Insurance and Freight' />
              <FormTextField name='codigoAduana' label='Código Aduana (SII)' placeholder='Ej: 3 (FOB), 1 (CIF), 2 (CFR), 5 (EXW)' />

              <div className='space-y-3 rounded-lg border p-3'>
                <p className='text-xs text-muted-foreground'>
                  Exigir estos montos al emitir Proforma/Factura con esta cláusula.
                  Ej: CIF → Flete y Seguro · C+F → solo Flete · FOB → ninguno.
                </p>
                <form.Field name='requiereFlete'>
                  {(field) => (
                    <div className='flex items-center gap-3'>
                      <Switch
                        id='requiereFlete'
                        checked={!!field.state.value}
                        onCheckedChange={(v) => field.handleChange(v)}
                      />
                      <Label htmlFor='requiereFlete' className='font-medium'>Requiere Flete</Label>
                    </div>
                  )}
                </form.Field>
                <form.Field name='requiereSeguro'>
                  {(field) => (
                    <div className='flex items-center gap-3'>
                      <Switch
                        id='requiereSeguro'
                        checked={!!field.state.value}
                        onCheckedChange={(v) => field.handleChange(v)}
                      />
                      <Label htmlFor='requiereSeguro' className='font-medium'>Requiere Seguro</Label>
                    </div>
                  )}
                </form.Field>
              </div>
            </form.Form>
          </form.AppForm>
        </div>

        <SheetFooter>
          <Button type='button' variant='outline' onClick={() => handleOpenChange(false)}>Cancelar</Button>
          <Button type='submit' form='clausula-venta-form' isLoading={isPending}>
            <Icons.check className='mr-1 h-4 w-4' />
            {isEdit ? 'Guardar cambios' : 'Crear cláusula de venta'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

export function ClausulaVentaFormSheetTrigger() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Icons.add className='mr-2 h-4 w-4' />
        Nueva cláusula de venta
      </Button>
      <ClausulaVentaFormSheet open={open} onOpenChange={setOpen} />
    </>
  )
}
