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
import { TipoParametroQuickCreate } from '@/features/tipos-parametro/components/tipo-parametro-quick-create'

const parametroSchema = z.object({
  codigo: z.string().min(1, 'Requerido').max(50).trim(),
  descripcion: z.string().min(1, 'Requerido').max(200).trim(),
  descripcionExtranjera: z.string().max(200).trim().optional(),
  tipoParametroId: z.coerce.number().int().min(1, 'Selecciona un tipo de parámetro'),
  requiereFlete: z.boolean(),
  requiereSeguro: z.boolean()
})

type ParametroFormValues = z.infer<typeof parametroSchema>

interface ParametroItem extends MantenedorSimple {
  tipoParametroId?: number
  tipoParametro?: { id: number; descripcion: string }
  requiereFlete?: boolean
  requiereSeguro?: boolean
}

interface ParametroFormSheetProps {
  item?: ParametroItem
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ParametroFormSheet({ item, open, onOpenChange }: ParametroFormSheetProps) {
  const isEdit = !!item
  const queryClient = useQueryClient()
  const mutations = createMantenedorMutations('parametros')
  const { keys } = createMantenedorQueries('parametros')
  const tiposQueries = createMantenedorQueries('tipos-parametro')

  const { data: tiposData } = useQuery(tiposQueries.listOptions({ limit: 300, soloActivos: true }))
  const tipos = tiposData?.data ?? []

  const createMutation = useMutation({
    ...mutations.create,
    onSuccess: () => {
      toast.success('Parámetro creado correctamente')
      onOpenChange(false)
      form.reset()
      queryClient.invalidateQueries({ queryKey: keys.all })
    },
    onError: (e: Error) => toast.error(e.message || 'Error al crear el parámetro')
  })

  const updateMutation = useMutation({
    ...mutations.update,
    onSuccess: () => {
      toast.success('Parámetro actualizado correctamente')
      onOpenChange(false)
      queryClient.invalidateQueries({ queryKey: keys.all })
    },
    onError: (e: Error) => toast.error(e.message || 'Error al actualizar el parámetro')
  })

  const form = useAppForm({
    defaultValues: {
      codigo: item?.codigo ?? '',
      descripcion: item?.descripcion ?? '',
      descripcionExtranjera: item?.descripcionExtranjera ?? '',
      tipoParametroId: item?.tipoParametroId ?? 0,
      requiereFlete: item?.requiereFlete ?? false,
      requiereSeguro: item?.requiereSeguro ?? false
    } as ParametroFormValues,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    validators: { onSubmit: parametroSchema as any },
    onSubmit: async ({ value }) => {
      if (isEdit) {
        await updateMutation.mutateAsync({ id: item.id, values: value })
      } else {
        await createMutation.mutateAsync(value)
      }
    }
  })

  const { FormTextField } = useFormFields<ParametroFormValues>()
  const isPending = createMutation.isPending || updateMutation.isPending

  const handleTipoCreado = (tipo: MantenedorSimple) => {
    form.setFieldValue('tipoParametroId', tipo.id)
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
          <SheetTitle>{isEdit ? 'Editar Parámetro' : 'Nuevo Parámetro'}</SheetTitle>
          <SheetDescription>
            {isEdit ? 'Modifica los datos del parámetro.' : 'Completa los datos para registrar un nuevo parámetro.'}
          </SheetDescription>
        </SheetHeader>

        <div className='flex-1 overflow-auto py-2'>
          <form.AppForm>
            <form.Form id='parametro-form' className='space-y-4 px-1'>
              <FormTextField name='codigo' label='Código' required placeholder='Ej: BRIX-01' disabled={isEdit} />
              <FormTextField name='descripcion' label='Descripción' required placeholder='Ej: Brix alto' />
              <FormTextField name='descripcionExtranjera' label='Descripción extranjera' placeholder='Ej: High Brix' />

              <form.Field name='tipoParametroId'>
                {(field) => (
                  <div className='space-y-1.5'>
                    <Label className='text-sm font-medium'>
                      Tipo de Parámetro <span className='text-destructive'>*</span>
                    </Label>
                    <div className='flex gap-2'>
                      <Select
                        value={field.state.value ? String(field.state.value) : ''}
                        onValueChange={(v) => field.handleChange(parseInt(v, 10))}
                      >
                        <SelectTrigger className='flex-1'>
                          <SelectValue placeholder='Seleccionar tipo...' />
                        </SelectTrigger>
                        <SelectContent>
                          {tipos.map((t) => (
                            <SelectItem key={t.id} value={String(t.id)}>
                              {t.descripcion}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <TipoParametroQuickCreate onCreated={handleTipoCreado} />
                    </div>
                    {field.state.meta.errors.length > 0 && (
                      <p className='text-sm text-destructive'>{String(field.state.meta.errors[0])}</p>
                    )}
                  </div>
                )}
              </form.Field>

              {/* Solo aplican cuando el parámetro es una CLÁUSULA DE VENTA
                  (Incoterm). Determinan si al facturar/proformar con esta
                  cláusula se exige el monto de Flete y/o Seguro. */}
              <div className='space-y-3 rounded-lg border p-3'>
                <p className='text-xs text-muted-foreground'>
                  Solo para cláusulas de venta (Incoterm): exigir estos montos al emitir Proforma/Factura.
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
          <Button type='submit' form='parametro-form' isLoading={isPending}>
            <Icons.check className='mr-1 h-4 w-4' />
            {isEdit ? 'Guardar cambios' : 'Crear parámetro'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

export function ParametroFormSheetTrigger() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Icons.add className='mr-2 h-4 w-4' />
        Nuevo parámetro
      </Button>
      <ParametroFormSheet open={open} onOpenChange={setOpen} />
    </>
  )
}
