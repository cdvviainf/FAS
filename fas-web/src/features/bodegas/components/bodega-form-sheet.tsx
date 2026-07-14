'use client'

import { useState, useMemo } from 'react'
import { useAppForm, useFormFields } from '@/components/ui/tanstack-form'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
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
import { Separator } from '@/components/ui/separator'
import { Icons } from '@/components/icons'
import { IconClipboard, IconTrash, IconPlus } from '@tabler/icons-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { z } from 'zod'
import { createMantenedorMutations } from '@/features/mantenedor-simple/mutations'
import { createMantenedorQueries } from '@/features/mantenedor-simple/queries'
import { createCodigoValidator } from '@/features/mantenedor-simple/service'
import type { MantenedorSimple } from '@/features/mantenedor-simple/types'
import { ComunaQuickCreate } from '@/features/comunas/components/comuna-quick-create'

const TIPOS_BODEGA = [
  { value: 'MATERIALES', label: 'Materiales' },
  { value: 'EMBARQUE', label: 'Embarque' },
  { value: 'DESPACHO', label: 'Despacho' },
] as const

const contactoSchema = z.object({
  nombre: z.string().min(1, 'Requerido').max(200).trim(),
  email: z.string().max(200).trim().optional(),
  telefono: z.string().max(50).trim().optional(),
})

type ContactoLocal = z.infer<typeof contactoSchema> & { _key: string }

const bodegaSchema = z.object({
  codigo: z.string().min(1, 'Requerido').max(50).trim(),
  descripcion: z.string().min(1, 'Requerido').max(200).trim(),
  descripcionExtranjera: z.string().max(200).trim().optional(),
  direccion: z.string().min(1, 'Requerido').max(500).trim(),
  comunaId: z.coerce.number().int().min(1, 'Selecciona una comuna'),
  tipos: z.array(z.string()).min(1, 'Selecciona al menos un tipo'),
  latitud: z.number().min(-90).max(90).optional().nullable(),
  longitud: z.number().min(-180).max(180).optional().nullable(),
  bloqueado: z.boolean(),
})

type BodegaFormValues = z.infer<typeof bodegaSchema>

interface ComunaItem { id: number; descripcion: string; provincia?: { id: number; descripcion: string } }

interface BodegaContacto { id?: number; nombre: string; email?: string; telefono?: string; orden?: number }

interface BodegaItem extends MantenedorSimple {
  comunaId?: number
  direccion?: string
  tipos?: string[]
  latitud?: number | null
  longitud?: number | null
  comuna?: ComunaItem
  contactos?: BodegaContacto[]
}

interface BodegaFormSheetProps {
  item?: BodegaItem
  open: boolean
  onOpenChange: (open: boolean) => void
}

function newContacto(): ContactoLocal {
  return { _key: crypto.randomUUID(), nombre: '', email: '', telefono: '' }
}

export function BodegaFormSheet({ item, open, onOpenChange }: BodegaFormSheetProps) {
  const isEdit = !!item
  const queryClient = useQueryClient()
  const mutations = createMantenedorMutations('bodegas')
  const { keys } = createMantenedorQueries('bodegas')
  const codigoValidator = useMemo(() => createCodigoValidator('bodegas'), [])

  const [contactos, setContactos] = useState<ContactoLocal[]>(() =>
    (item?.contactos ?? []).map((c) => ({ ...c, _key: crypto.randomUUID() }))
  )

  const comunasQueries = createMantenedorQueries('comunas')
  const { data: comunasData } = useQuery(comunasQueries.listOptions({ limit: 500, soloActivos: true }))
  const comunas = (comunasData?.data ?? []) as ComunaItem[]

  const form = useAppForm({
    defaultValues: {
      codigo: item?.codigo ?? '',
      descripcion: item?.descripcion ?? '',
      descripcionExtranjera: item?.descripcionExtranjera ?? '',
      direccion: item?.direccion ?? '',
      comunaId: item?.comunaId ?? 0,
      tipos: item?.tipos ?? [],
      latitud: item?.latitud ?? null,
      longitud: item?.longitud ?? null,
      bloqueado: item?.bloqueado ?? false,
    } as BodegaFormValues,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    validators: { onSubmit: bodegaSchema as any },
    onSubmit: async ({ value }) => {
      const contactosPayload = contactos
        .filter((c) => c.nombre.trim())
        .map((c, idx) => ({ nombre: c.nombre, email: c.email || undefined, telefono: c.telefono || undefined, orden: idx }))
      const payload = { ...value, contactos: contactosPayload }
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
      toast.success('Bodega creada correctamente')
      onOpenChange(false)
      form.reset()
      setContactos([])
      queryClient.invalidateQueries({ queryKey: keys.all })
    },
    onError: (e: Error) => toast.error(e.message || 'Error al crear la bodega')
  })

  const updateMutation = useMutation({
    ...mutations.update,
    onSuccess: () => {
      toast.success('Bodega actualizada correctamente')
      onOpenChange(false)
      queryClient.invalidateQueries({ queryKey: keys.all })
    },
    onError: (e: Error) => toast.error(e.message || 'Error al actualizar la bodega')
  })

  const { FormTextField, FormSwitchField } = useFormFields<BodegaFormValues>()
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
          <SheetTitle>{isEdit ? 'Editar Bodega' : 'Nueva Bodega'}</SheetTitle>
          <SheetDescription>
            {isEdit ? 'Modifica los datos de la bodega.' : 'Registra una nueva bodega o instalación.'}
          </SheetDescription>
        </SheetHeader>

        <div className='flex-1 overflow-auto py-2'>
          <form.AppForm>
            <form.Form id='bodega-form' className='space-y-4 px-1'>
              <FormTextField
                name='codigo'
                label='Código'
                required
                placeholder='Ej: BOD-01'
                disabled={isEdit}
                validators={isEdit ? undefined : codigoValidator}
              />
              <FormTextField
                name='descripcion'
                label='Descripción'
                required
                placeholder='Ej: Bodega Principal'
              />
              <FormTextField
                name='descripcionExtranjera'
                label='Descripción extranjera'
                placeholder='Ej: Main Warehouse'
              />
              <FormTextField
                name='direccion'
                label='Dirección'
                required
                placeholder='Ej: Av. Portales 1234'
              />

              <form.Field name='comunaId'>
                {(field) => (
                  <div className='space-y-1.5'>
                    <Label className='text-sm font-medium'>
                      Comuna <span className='text-destructive'>*</span>
                    </Label>
                    <div className='flex gap-2'>
                      <Select
                        value={field.state.value ? String(field.state.value) : ''}
                        onValueChange={(v) => field.handleChange(parseInt(v, 10))}
                      >
                        <SelectTrigger className='flex-1'>
                          <SelectValue placeholder='Seleccionar comuna...' />
                        </SelectTrigger>
                        <SelectContent>
                          {comunas.map((c) => (
                            <SelectItem key={c.id} value={String(c.id)}>
                              {c.descripcion}
                              {c.provincia && (
                                <span className='text-muted-foreground text-xs ml-1.5'>({c.provincia.descripcion})</span>
                              )}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <ComunaQuickCreate onCreated={(c) => field.handleChange(c.id)} />
                    </div>
                    {field.state.meta.errors.length > 0 && (
                      <p className='text-sm text-destructive'>{String(field.state.meta.errors[0])}</p>
                    )}
                  </div>
                )}
              </form.Field>

              {/* Tipos de bodega */}
              <form.Field name='tipos'>
                {(field) => (
                  <div className='space-y-2'>
                    <Label className='text-sm font-medium'>
                      Tipos <span className='text-destructive'>*</span>
                    </Label>
                    <div className='flex flex-wrap gap-4'>
                      {TIPOS_BODEGA.map((tipo) => {
                        const checked = (field.state.value as string[]).includes(tipo.value)
                        return (
                          <div key={tipo.value} className='flex items-center gap-2'>
                            <Checkbox
                              id={`tipo-${tipo.value}`}
                              checked={checked}
                              onCheckedChange={(v) => {
                                const current = field.state.value as string[]
                                if (v) {
                                  field.handleChange([...current, tipo.value])
                                } else {
                                  field.handleChange(current.filter((t) => t !== tipo.value))
                                }
                              }}
                            />
                            <label
                              htmlFor={`tipo-${tipo.value}`}
                              className='text-sm font-medium cursor-pointer'
                            >
                              {tipo.label}
                            </label>
                          </div>
                        )
                      })}
                    </div>
                    {field.state.meta.errors.length > 0 && (
                      <p className='text-sm text-destructive'>{String(field.state.meta.errors[0])}</p>
                    )}
                  </div>
                )}
              </form.Field>

              {/* Coordenadas */}
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

              {isEdit && (
                <FormSwitchField
                  name='bloqueado'
                  label='Bloqueado'
                  description='Una bodega bloqueada no aparece en los selectores de nuevos registros.'
                />
              )}
            </form.Form>
          </form.AppForm>

          <Separator className='my-4' />

          {/* Contactos */}
          <div className='space-y-3 px-1'>
            <div className='flex items-center justify-between'>
              <Label className='text-sm font-medium'>Contactos</Label>
              <Button
                type='button'
                variant='outline'
                size='sm'
                className='h-7 gap-1 text-xs'
                onClick={() => setContactos((prev) => [...prev, newContacto()])}
              >
                <IconPlus className='h-3.5 w-3.5' />
                Agregar
              </Button>
            </div>

            {contactos.length === 0 && (
              <p className='text-xs text-muted-foreground py-2'>Sin contactos registrados.</p>
            )}

            <div className='space-y-3'>
              {contactos.map((c, idx) => (
                <div key={c._key} className='rounded-md border p-3 space-y-2'>
                  <div className='flex items-center justify-between'>
                    <span className='text-xs font-medium text-muted-foreground'>Contacto {idx + 1}</span>
                    <Button
                      type='button'
                      variant='ghost'
                      size='icon'
                      className='h-6 w-6 text-destructive hover:text-destructive'
                      onClick={() => setContactos((prev) => prev.filter((x) => x._key !== c._key))}
                    >
                      <IconTrash className='h-3.5 w-3.5' />
                    </Button>
                  </div>
                  <div className='space-y-2'>
                    <div>
                      <Label className='text-xs'>Nombre <span className='text-destructive'>*</span></Label>
                      <Input
                        value={c.nombre}
                        onChange={(e) => setContactos((prev) =>
                          prev.map((x) => x._key === c._key ? { ...x, nombre: e.target.value } : x)
                        )}
                        placeholder='Nombre del contacto'
                        className='h-8 text-sm mt-1'
                      />
                    </div>
                    <div className='grid grid-cols-2 gap-2'>
                      <div>
                        <Label className='text-xs'>Email</Label>
                        <Input
                          type='email'
                          value={c.email ?? ''}
                          onChange={(e) => setContactos((prev) =>
                            prev.map((x) => x._key === c._key ? { ...x, email: e.target.value } : x)
                          )}
                          placeholder='correo@ejemplo.com'
                          className='h-8 text-sm mt-1'
                        />
                      </div>
                      <div>
                        <Label className='text-xs'>Teléfono</Label>
                        <Input
                          type='tel'
                          value={c.telefono ?? ''}
                          onChange={(e) => setContactos((prev) =>
                            prev.map((x) => x._key === c._key ? { ...x, telefono: e.target.value } : x)
                          )}
                          placeholder='+56 9 1234 5678'
                          className='h-8 text-sm mt-1'
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <SheetFooter>
          <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type='submit' form='bodega-form' isLoading={isPending}>
            <Icons.check className='mr-1 h-4 w-4' />
            {isEdit ? 'Guardar cambios' : 'Crear bodega'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

export function BodegaFormSheetTrigger() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Icons.add className='mr-2 h-4 w-4' />
        Nueva bodega
      </Button>
      <BodegaFormSheet open={open} onOpenChange={setOpen} />
    </>
  )
}
