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
import { Badge } from '@/components/ui/badge'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { z } from 'zod'
import { createMantenedorMutations } from '@/features/mantenedor-simple/mutations'
import { createMantenedorQueries } from '@/features/mantenedor-simple/queries'
import { createCodigoValidator } from '@/features/mantenedor-simple/service'
import type { MantenedorSimple } from '@/features/mantenedor-simple/types'
import { PaisQuickCreate } from '@/features/paises/components/pais-quick-create'
import { TipoEmbarqueQuickCreate } from '@/features/tipos-embarque/components/tipo-embarque-quick-create'
import { IconClipboard } from '@tabler/icons-react'

const puertoSchema = z.object({
  codigo: z.string().min(1, 'Requerido').max(50).trim(),
  descripcion: z.string().min(1, 'Requerido').max(200).trim(),
  descripcionExtranjera: z.string().max(200).trim().optional(),
  paisId: z.number().int().min(1, 'Selecciona un país'),
  tipoEmbarqueId: z.number().int().min(1, 'Selecciona un tipo de embarque'),
  latitud: z.number().min(-90).max(90).optional().nullable(),
  longitud: z.number().min(-180).max(180).optional().nullable(),
})

type PuertoFormValues = z.infer<typeof puertoSchema>

interface PuertoItem extends MantenedorSimple {
  paisId?: number
  tipoEmbarqueId?: number
  latitud?: number | null
  longitud?: number | null
  pais?: { id: number; descripcion: string; codigo: string; esPaisOrigen: boolean }
  tipoEmbarque?: { id: number; descripcion: string }
}

interface PuertoFormSheetProps {
  item?: PuertoItem
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PuertoFormSheet({ item, open, onOpenChange }: PuertoFormSheetProps) {
  const isEdit = !!item
  const queryClient = useQueryClient()
  const mutations = createMantenedorMutations('puertos')
  const { keys } = createMantenedorQueries('puertos')
  const codigoValidator = useMemo(() => createCodigoValidator('puertos'), [])
  const paisesQueries = createMantenedorQueries('paises')
  const embarquesQueries = createMantenedorQueries('tipos-embarque')

  const { data: paisesData } = useQuery(paisesQueries.listOptions({ limit: 300, soloActivos: true }))
  const paises = paisesData?.data ?? []

  const { data: embarquesData } = useQuery(embarquesQueries.listOptions({ limit: 300, soloActivos: true }))
  const embarques = embarquesData?.data ?? []

  const form = useAppForm({
    defaultValues: {
      codigo: item?.codigo ?? '',
      descripcion: item?.descripcion ?? '',
      descripcionExtranjera: item?.descripcionExtranjera ?? '',
      paisId: item?.paisId ?? 0,
      tipoEmbarqueId: item?.tipoEmbarqueId ?? 0,
      latitud: item?.latitud ?? null,
      longitud: item?.longitud ?? null,
    } as PuertoFormValues,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    validators: { onSubmit: puertoSchema as any },
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
      toast.success('Puerto creado correctamente')
      onOpenChange(false)
      form.reset()
      queryClient.invalidateQueries({ queryKey: keys.all })
    },
    onError: (e: Error) => toast.error(e.message || 'Error al crear el puerto')
  })

  const updateMutation = useMutation({
    ...mutations.update,
    onSuccess: () => {
      toast.success('Puerto actualizado correctamente')
      onOpenChange(false)
      queryClient.invalidateQueries({ queryKey: keys.all })
    },
    onError: (e: Error) => toast.error(e.message || 'Error al actualizar el puerto')
  })

  const { FormTextField } = useFormFields<PuertoFormValues>()
  const isPending = createMutation.isPending || updateMutation.isPending

  const handleGeosPaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      const match = text.trim().match(/^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/)
      if (match) {
        form.setFieldValue('latitud', parseFloat(match[1]))
        form.setFieldValue('longitud', parseFloat(match[2]))
        toast.success('Coordenadas pegadas correctamente')
      } else {
        toast.error('Formato no reconocido. Copia las coordenadas desde Google Maps (lat, lng)')
      }
    } catch {
      toast.error('No se pudo leer el portapapeles')
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='flex flex-col sm:max-w-md'>
        <SheetHeader>
          <SheetTitle>{isEdit ? 'Editar Puerto' : 'Nuevo Puerto'}</SheetTitle>
          <SheetDescription>
            {isEdit ? 'Modifica los datos del puerto.' : 'Registra un nuevo puerto de origen o destino.'}
          </SheetDescription>
        </SheetHeader>

        <div className='flex-1 overflow-auto py-2'>
          <form.AppForm>
            <form.Form id='puerto-form' className='space-y-4 px-1'>
              <FormTextField name='codigo' label='Código' required placeholder='Ej: SAN' disabled={isEdit} validators={isEdit ? undefined : codigoValidator} />
              <FormTextField name='descripcion' label='Descripción' required placeholder='Ej: San Antonio' />
              <FormTextField name='descripcionExtranjera' label='Descripción extranjera' placeholder='Ej: Port of San Antonio' />

              <form.Field name='paisId'>
                {(field) => (
                  <div className='space-y-1.5'>
                    <Label className='text-sm font-medium'>
                      País <span className='text-destructive'>*</span>
                    </Label>
                    <div className='flex gap-2'>
                      <Select
                        value={field.state.value ? String(field.state.value) : ''}
                        onValueChange={(v) => field.handleChange(parseInt(v, 10))}
                      >
                        <SelectTrigger className='flex-1'>
                          <SelectValue placeholder='Seleccionar país...' />
                        </SelectTrigger>
                        <SelectContent>
                          {paises.map((p) => {
                            const pais = p as MantenedorSimple & { esPaisOrigen?: boolean; codigo?: string }
                            return (
                              <SelectItem key={pais.id} value={String(pais.id)}>
                                <span className='font-mono text-xs text-muted-foreground mr-2'>{pais.codigo}</span>
                                {pais.descripcion}
                                {pais.esPaisOrigen && (
                                  <Badge variant='outline' className='ml-2 text-xs py-0'>Origen</Badge>
                                )}
                              </SelectItem>
                            )
                          })}
                        </SelectContent>
                      </Select>
                      <PaisQuickCreate onCreated={(pais) => field.handleChange(pais.id)} />
                    </div>
                    {field.state.meta.errors.length > 0 && (
                      <p className='text-sm text-destructive'>{String(field.state.meta.errors[0])}</p>
                    )}
                  </div>
                )}
              </form.Field>

              <form.Field name='tipoEmbarqueId'>
                {(field) => (
                  <div className='space-y-1.5'>
                    <Label className='text-sm font-medium'>
                      Tipo de Embarque <span className='text-destructive'>*</span>
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
                          {embarques.map((e) => (
                            <SelectItem key={e.id} value={String(e.id)}>
                              {e.descripcion}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <TipoEmbarqueQuickCreate onCreated={(t) => field.handleChange(t.id)} />
                    </div>
                    {field.state.meta.errors.length > 0 && (
                      <p className='text-sm text-destructive'>{String(field.state.meta.errors[0])}</p>
                    )}
                  </div>
                )}
              </form.Field>

              <div className='space-y-1.5'>
                <div className='flex items-center justify-between'>
                  <Label className='text-sm font-medium text-muted-foreground'>Coordenadas (opcional)</Label>
                  <Button
                    type='button'
                    variant='ghost'
                    size='sm'
                    className='h-7 px-2 text-xs gap-1'
                    onClick={handleGeosPaste}
                    title='Pegar coordenadas desde Google Maps (lat, lng)'
                  >
                    <IconClipboard className='h-3.5 w-3.5' />
                    Pegar coords
                  </Button>
                </div>
                <div className='grid grid-cols-2 gap-4'>
                  <FormTextField name='latitud' label='Latitud' placeholder='Ej: -33.5928' type='number' />
                  <FormTextField name='longitud' label='Longitud' placeholder='Ej: -71.6128' type='number' />
                </div>
              </div>
            </form.Form>
          </form.AppForm>
        </div>

        <SheetFooter>
          <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type='submit' form='puerto-form' isLoading={isPending}>
            <Icons.check className='mr-1 h-4 w-4' />
            {isEdit ? 'Guardar cambios' : 'Crear puerto'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

export function PuertoFormSheetTrigger() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Icons.add className='mr-2 h-4 w-4' />
        Nuevo puerto
      </Button>
      <PuertoFormSheet open={open} onOpenChange={setOpen} />
    </>
  )
}
