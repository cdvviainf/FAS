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
import { Checkbox } from '@/components/ui/checkbox'
import { Icons } from '@/components/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { z } from 'zod'
import { createMantenedorMutations } from '@/features/mantenedor-simple/mutations'
import { createMantenedorQueries } from '@/features/mantenedor-simple/queries'
import type { MantenedorSimple } from '@/features/mantenedor-simple/types'
import { EspecieQuickCreate } from '@/features/especies/components/especie-quick-create'

const OPCIONES_CONTROL = [
  { value: 'COMERCIAL', label: 'Comercial' },
  { value: 'CALIDAD', label: 'Calidad' },
] as const

const categoriaSchema = z.object({
  codigo: z.string().min(1, 'Requerido').max(50).trim(),
  descripcion: z.string().min(1, 'Requerido').max(200).trim(),
  descripcionExtranjera: z.string().max(200).trim().optional(),
  especieId: z.coerce.number().int().min(1, 'Selecciona una especie'),
  orden: z.coerce.number().int().min(1, 'El orden debe ser mayor a 0'),
  control: z.array(z.string()),
})

type CategoriaFormValues = z.infer<typeof categoriaSchema>

interface CategoriaItem extends MantenedorSimple {
  especieId?: number
  orden?: number
  control?: string[]
  especie?: { id: number; descripcion: string }
}

interface CategoriaFormSheetProps {
  item?: CategoriaItem
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CategoriaFormSheet({ item, open, onOpenChange }: CategoriaFormSheetProps) {
  const isEdit = !!item
  const queryClient = useQueryClient()
  const mutations = createMantenedorMutations('categorias')
  const { keys } = createMantenedorQueries('categorias')
  const especiesQueries = createMantenedorQueries('especies')

  const { data: especiesData } = useQuery(especiesQueries.listOptions({ limit: 300, soloActivos: true }))
  const especies = especiesData?.data ?? []

  const createMutation = useMutation({
    ...mutations.create,
    onSuccess: () => {
      toast.success('Categoría creada correctamente')
      onOpenChange(false)
      form.reset()
      queryClient.invalidateQueries({ queryKey: keys.all })
    },
    onError: (e: Error) => toast.error(e.message || 'Error al crear la categoría')
  })

  const updateMutation = useMutation({
    ...mutations.update,
    onSuccess: () => {
      toast.success('Categoría actualizada correctamente')
      onOpenChange(false)
      queryClient.invalidateQueries({ queryKey: keys.all })
    },
    onError: (e: Error) => toast.error(e.message || 'Error al actualizar la categoría')
  })

  const form = useAppForm({
    defaultValues: {
      codigo: item?.codigo ?? '',
      descripcion: item?.descripcion ?? '',
      descripcionExtranjera: item?.descripcionExtranjera ?? '',
      especieId: item?.especieId ?? 0,
      orden: item?.orden ?? 1,
      control: item?.control ?? [],
    } as CategoriaFormValues,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    validators: { onSubmit: categoriaSchema as any },
    onSubmit: async ({ value }) => {
      if (isEdit) {
        await updateMutation.mutateAsync({ id: item.id, values: value })
      } else {
        await createMutation.mutateAsync(value)
      }
    }
  })

  const { FormTextField } = useFormFields<CategoriaFormValues>()
  const isPending = createMutation.isPending || updateMutation.isPending

  const handleEspecieCreada = (especie: MantenedorSimple) => {
    form.setFieldValue('especieId', especie.id)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='flex flex-col sm:max-w-md'>
        <SheetHeader>
          <SheetTitle>{isEdit ? 'Editar Categoría' : 'Nueva Categoría'}</SheetTitle>
          <SheetDescription>
            {isEdit ? 'Modifica los datos de la categoría.' : 'Completa los datos para registrar una nueva categoría.'}
          </SheetDescription>
        </SheetHeader>

        <div className='flex-1 overflow-auto py-2'>
          <form.AppForm>
            <form.Form id='categoria-form' className='space-y-4 px-1'>
              <FormTextField name='codigo' label='Código' required placeholder='Ej: CAT-1' disabled={isEdit} />
              <FormTextField name='descripcion' label='Descripción' required placeholder='Ej: Primera' />
              <FormTextField name='descripcionExtranjera' label='Descripción extranjera' placeholder='Ej: First' />

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

              <FormTextField name='orden' label='Orden' required placeholder='Ej: 1' type='number' />

              <form.Field name='control'>
                {(field) => (
                  <div className='space-y-2'>
                    <Label className='text-sm font-medium'>Control</Label>
                    <p className='text-xs text-muted-foreground'>Flujos de trabajo donde aparece esta categoría.</p>
                    <div className='flex gap-6'>
                      {OPCIONES_CONTROL.map((op) => {
                        const checked = (field.state.value as string[]).includes(op.value)
                        return (
                          <div key={op.value} className='flex items-center gap-2'>
                            <Checkbox
                              id={`cat-ctrl-${op.value}`}
                              checked={checked}
                              onCheckedChange={(v) => {
                                const current = field.state.value as string[]
                                field.handleChange(
                                  v ? [...current, op.value] : current.filter((c) => c !== op.value)
                                )
                              }}
                            />
                            <label htmlFor={`cat-ctrl-${op.value}`} className='text-sm cursor-pointer'>
                              {op.label}
                            </label>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </form.Field>
            </form.Form>
          </form.AppForm>
        </div>

        <SheetFooter>
          <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type='submit' form='categoria-form' isLoading={isPending}>
            <Icons.check className='mr-1 h-4 w-4' />
            {isEdit ? 'Guardar cambios' : 'Crear categoría'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

export function CategoriaFormSheetTrigger() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Icons.add className='mr-2 h-4 w-4' />
        Nueva categoría
      </Button>
      <CategoriaFormSheet open={open} onOpenChange={setOpen} />
    </>
  )
}
