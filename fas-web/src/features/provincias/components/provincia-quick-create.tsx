'use client'

import { useState } from 'react'
import { useAppForm, useFormFields } from '@/components/ui/tanstack-form'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
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
import { usePuedeEscribir } from '@/hooks/use-item-acceso'
import type { MantenedorSimple } from '@/features/mantenedor-simple/types'
import { RegionQuickCreate } from '@/features/regiones/components/region-quick-create'

const provinciaQuickSchema = z.object({
  codigo: z.string().min(1, 'Requerido').max(50).trim(),
  descripcion: z.string().min(1, 'Requerido').max(200).trim(),
  descripcionExtranjera: z.string().max(200).trim().optional(),
  regionId: z.coerce.number().int().min(1, 'Selecciona una región'),
})

type ProvinciaQuickFormValues = z.infer<typeof provinciaQuickSchema>

interface ProvinciaQuickCreateProps {
  onCreated: (item: MantenedorSimple) => void
}

function ProvinciaQuickDialog({
  open,
  onOpenChange,
  onCreated
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreated: (item: MantenedorSimple) => void
}) {
  const queryClient = useQueryClient()
  const mutations = createMantenedorMutations('provincias')
  const { keys } = createMantenedorQueries('provincias')
  const regionesQueries = createMantenedorQueries('regiones')

  const { data: regionesData } = useQuery(regionesQueries.listOptions({ limit: 300, soloActivos: true }))
  const regiones = regionesData?.data ?? []

  const mutation = useMutation({
    ...mutations.create,
    onSuccess: (newItem) => {
      queryClient.invalidateQueries({ queryKey: keys.all })
      toast.success(`Provincia "${newItem.descripcion}" creada`)
      onCreated(newItem)
      onOpenChange(false)
      form.reset()
    },
    onError: () => toast.error('Error al crear la provincia')
  })

  const form = useAppForm({
    defaultValues: {
      codigo: '',
      descripcion: '',
      descripcionExtranjera: '',
      regionId: 0,
    } as ProvinciaQuickFormValues,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    validators: { onSubmit: provinciaQuickSchema as any },
    onSubmit: async ({ value }) => { await mutation.mutateAsync(value) }
  })

  const { FormTextField } = useFormFields<ProvinciaQuickFormValues>()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-sm'>
        <DialogHeader>
          <DialogTitle>Nueva Provincia</DialogTitle>
          <DialogDescription>
            La provincia quedará disponible inmediatamente en el selector.
          </DialogDescription>
        </DialogHeader>

        <form.AppForm>
          <form.Form id='provincia-quick-form' className='space-y-3'>
            <FormTextField name='codigo' label='Código' required placeholder='Ej: RM-01' />
            <FormTextField name='descripcion' label='Descripción' required placeholder='Ej: Santiago' />
            <FormTextField name='descripcionExtranjera' label='Descripción extranjera' placeholder='Ej: Santiago' />

            <form.Field name='regionId'>
              {(field) => (
                <div className='space-y-1.5'>
                  <Label className='text-sm font-medium'>
                    Región <span className='text-destructive'>*</span>
                  </Label>
                  <div className='flex items-center gap-2'>
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
                    <RegionQuickCreate onCreated={(newRegion) => {
                      queryClient.invalidateQueries({ queryKey: regionesQueries.keys.all })
                      field.handleChange(newRegion.id)
                    }} />
                  </div>
                  {field.state.meta.errors.length > 0 && (
                    <p className='text-sm text-destructive'>{String(field.state.meta.errors[0])}</p>
                  )}
                </div>
              )}
            </form.Field>
          </form.Form>
        </form.AppForm>

        <DialogFooter>
          <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type='submit' form='provincia-quick-form' isLoading={mutation.isPending}>
            <Icons.check className='mr-1 h-4 w-4' />
            Crear provincia
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ProvinciaQuickCreate({ onCreated }: ProvinciaQuickCreateProps) {
  const [open, setOpen] = useState(false)
  const puedeEscribir = usePuedeEscribir('config.provincias')

  if (!puedeEscribir) return null

  return (
    <>
      <Button
        type='button'
        variant='outline'
        size='icon'
        className='h-9 w-9 shrink-0 self-end'
        onClick={() => setOpen(true)}
        title='Crear nueva provincia'
      >
        <Icons.add className='h-4 w-4' />
      </Button>
      {open && <ProvinciaQuickDialog open onOpenChange={setOpen} onCreated={onCreated} />}
    </>
  )
}
