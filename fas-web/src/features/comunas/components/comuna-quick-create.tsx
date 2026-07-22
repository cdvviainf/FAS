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
import { ProvinciaQuickCreate } from '@/features/provincias/components/provincia-quick-create'

const comunaQuickSchema = z.object({
  codigo: z.string().min(1, 'Requerido').max(50).trim(),
  descripcion: z.string().min(1, 'Requerido').max(200).trim(),
  provinciaId: z.coerce.number().int().min(1, 'Selecciona una provincia'),
})

type ComunaQuickFormValues = z.infer<typeof comunaQuickSchema>

interface ComunaQuickCreateProps {
  onCreated: (item: MantenedorSimple) => void
}

function ComunaQuickDialog({
  open,
  onOpenChange,
  onCreated
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreated: (item: MantenedorSimple) => void
}) {
  const queryClient = useQueryClient()
  const mutations = createMantenedorMutations('comunas')
  const { keys } = createMantenedorQueries('comunas')
  const provinciasQueries = createMantenedorQueries('provincias')


  const { data: provinciasData } = useQuery(provinciasQueries.listOptions({ limit: 300, soloActivos: true }))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const provincias = (provinciasData?.data ?? []) as any[]

  const mutation = useMutation({
    ...mutations.create,
    onSuccess: (newItem) => {
      queryClient.invalidateQueries({ queryKey: keys.all })
      toast.success(`Comuna "${newItem.descripcion}" creada`)
      onCreated(newItem)
      onOpenChange(false)
      form.reset()
    },
    onError: () => toast.error('Error al crear la comuna')
  })

  const form = useAppForm({
    defaultValues: {
      codigo: '',
      descripcion: '',
      provinciaId: 0,
    } as ComunaQuickFormValues,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    validators: { onSubmit: comunaQuickSchema as any },
    onSubmit: async ({ value }) => { await mutation.mutateAsync(value) }
  })

  const { FormTextField } = useFormFields<ComunaQuickFormValues>()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-sm'>
        <DialogHeader>
          <DialogTitle>Nueva Comuna</DialogTitle>
          <DialogDescription>
            La comuna quedará disponible inmediatamente en el selector.
          </DialogDescription>
        </DialogHeader>

        <form.AppForm>
          <form.Form id='comuna-quick-form' className='space-y-3'>
            <FormTextField name='codigo' label='Código' required placeholder='Ej: STGO-01' />
            <FormTextField name='descripcion' label='Descripción' required placeholder='Ej: Santiago' />

            <form.Field name='provinciaId'>
              {(field) => (
                <div className='space-y-1.5'>
                  <Label className='text-sm font-medium'>
                    Provincia <span className='text-destructive'>*</span>
                  </Label>
                  <div className='flex items-center gap-2'>
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
                            <span className='text-muted-foreground text-xs mr-1.5'>{p.region?.descripcion ?? ''} ›</span>
                            {p.descripcion}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <ProvinciaQuickCreate onCreated={(newProvincia) => {
                      queryClient.invalidateQueries({ queryKey: provinciasQueries.keys.all })
                      field.handleChange(newProvincia.id)
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
          <Button type='submit' form='comuna-quick-form' isLoading={mutation.isPending}>
            <Icons.check className='mr-1 h-4 w-4' />
            Crear comuna
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ComunaQuickCreate({ onCreated }: ComunaQuickCreateProps) {
  const [open, setOpen] = useState(false)
  const puedeEscribir = usePuedeEscribir('config.comunas')

  if (!puedeEscribir) return null

  return (
    <>
      <Button
        type='button'
        variant='outline'
        size='icon'
        className='h-9 w-9 shrink-0 self-end'
        onClick={() => setOpen(true)}
        title='Crear nueva comuna'
      >
        <Icons.add className='h-4 w-4' />
      </Button>
      {open && <ComunaQuickDialog open onOpenChange={setOpen} onCreated={onCreated} />}
    </>
  )
}
