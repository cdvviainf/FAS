'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Icons } from '@/components/icons'
import { useAppForm, useFormFields } from '@/components/ui/tanstack-form'
import { itemsMenuOptions, perfilDetailOptions, perfilesKeys } from '../queries'
import { perfilesService } from '../service'
import type { NivelAcceso, ItemMenu } from '../types'

const perfilSchema = z.object({
  codigo: z.string().min(1, 'El código es requerido').max(50).trim(),
  descripcion: z.string().min(1, 'La descripción es requerida').max(200).trim(),
})

type PerfilFormValues = z.infer<typeof perfilSchema>

const NIVEL_OPTIONS: { value: NivelAcceso; label: string }[] = [
  { value: 'SIN_ACCESO', label: 'Sin Acceso' },
  { value: 'LECTURA', label: 'Lectura' },
  { value: 'TOTAL', label: 'Total' },
]

interface PerfilFormProps {
  perfilId?: number
}

export function PerfilForm({ perfilId }: PerfilFormProps) {
  const isEdit = !!perfilId
  const router = useRouter()
  const queryClient = useQueryClient()

  // Map itemMenuId -> nivel (local state for the matrix)
  const [accesosMap, setAccesosMap] = useState<Map<number, NivelAcceso>>(new Map())

  const { data: itemsMenu, isLoading: loadingItems } = useQuery(itemsMenuOptions())
  const { data: perfilData, isLoading: loadingPerfil } = useQuery(
    perfilDetailOptions(perfilId ?? 0)
  )

  const createMutation = useMutation({
    mutationFn: (values: PerfilFormValues) =>
      perfilesService.create({
        ...values,
        accesos: buildAccesosPayload(),
      }),
    onSuccess: () => {
      toast.success('Perfil creado correctamente')
      queryClient.invalidateQueries({ queryKey: perfilesKeys.all })
      router.push('/dashboard/configuracion/perfiles')
    },
    onError: (e: Error) => toast.error(e.message || 'Error al crear el perfil'),
  })

  const updateMutation = useMutation({
    mutationFn: (values: PerfilFormValues) =>
      perfilesService.update(perfilId!, {
        ...values,
        accesos: buildAccesosPayload(),
      }),
    onSuccess: () => {
      toast.success('Perfil actualizado correctamente')
      queryClient.invalidateQueries({ queryKey: perfilesKeys.all })
      queryClient.invalidateQueries({ queryKey: perfilesKeys.detail(perfilId!) })
      router.push('/dashboard/configuracion/perfiles')
    },
    onError: (e: Error) => toast.error(e.message || 'Error al actualizar el perfil'),
  })

  function buildAccesosPayload() {
    const accesos: { itemMenuId: number; nivel: NivelAcceso }[] = []
    accesosMap.forEach((nivel, itemMenuId) => {
      if (nivel !== 'SIN_ACCESO') {
        accesos.push({ itemMenuId, nivel })
      }
    })
    return accesos
  }

  function setNivel(itemMenuId: number, nivel: NivelAcceso) {
    setAccesosMap((prev) => {
      const next = new Map(prev)
      next.set(itemMenuId, nivel)
      return next
    })
  }

  function getNivel(itemMenuId: number): NivelAcceso {
    return accesosMap.get(itemMenuId) ?? 'SIN_ACCESO'
  }

  // Group items by section
  const itemsBySection = useMemo(() => {
    if (!itemsMenu) return new Map<string, ItemMenu[]>()
    const map = new Map<string, ItemMenu[]>()
    for (const item of itemsMenu) {
      if (!map.has(item.seccion)) map.set(item.seccion, [])
      map.get(item.seccion)!.push(item)
    }
    return map
  }, [itemsMenu])

  const isPending = createMutation.isPending || updateMutation.isPending

  const form = useAppForm({
    defaultValues: {
      codigo: perfilData?.codigo ?? '',
      descripcion: perfilData?.descripcion ?? '',
    } as PerfilFormValues,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    validators: { onSubmit: perfilSchema as any },
    onSubmit: async ({ value }) => {
      if (isEdit) {
        await updateMutation.mutateAsync(value)
      } else {
        await createMutation.mutateAsync(value)
      }
    },
  })

  // Populate form and matrix when perfil data loads
  useEffect(() => {
    if (perfilData) {
      form.setFieldValue('codigo', perfilData.codigo)
      form.setFieldValue('descripcion', perfilData.descripcion)
      const map = new Map<number, NivelAcceso>()
      for (const acceso of perfilData.accesos) {
        map.set(acceso.itemMenuId, acceso.nivel)
      }
      setAccesosMap(map)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfilData])

  const { FormTextField } = useFormFields<PerfilFormValues>()

  const isLoading = (isEdit && loadingPerfil) || loadingItems

  if (isLoading) {
    return (
      <div className='space-y-4'>
        <div className='animate-pulse h-10 bg-muted rounded' />
        <div className='animate-pulse h-10 bg-muted rounded' />
        <div className='animate-pulse h-64 bg-muted rounded' />
      </div>
    )
  }

  return (
    <div className='space-y-6'>
      {/* Datos básicos */}
      <Card>
        <CardHeader>
          <CardTitle className='text-base'>Datos del Perfil</CardTitle>
        </CardHeader>
        <CardContent>
          <form.AppForm>
            <form.Form id='perfil-form' className='grid gap-4 sm:grid-cols-2 p-0 m-0'>
              <FormTextField
                name='codigo'
                label='Código'
                required
                placeholder='Ej: ADMIN'
                disabled={isEdit}
              />
              <FormTextField
                name='descripcion'
                label='Descripción'
                required
                placeholder='Ej: Administrador del sistema'
              />
            </form.Form>
          </form.AppForm>
        </CardContent>
      </Card>

      {/* Matriz de permisos */}
      <Card>
        <CardHeader>
          <CardTitle className='text-base'>Matriz de Permisos</CardTitle>
        </CardHeader>
        <CardContent>
          {itemsBySection.size === 0 ? (
            <p className='text-sm text-muted-foreground py-4 text-center'>
              No hay ítems de menú configurados.
            </p>
          ) : (
            <div className='space-y-4'>
              {Array.from(itemsBySection.entries()).map(([seccion, items], sectionIndex) => (
                <div key={seccion}>
                  <h4 className='text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2'>
                    {seccion}
                  </h4>
                  <div className='rounded-md border overflow-hidden'>
                    <table className='w-full text-sm'>
                      <thead className='bg-muted/50'>
                        <tr>
                          <th className='text-left py-2 px-3 font-medium text-xs text-muted-foreground'>Ítem</th>
                          <th className='text-left py-2 px-3 font-medium text-xs text-muted-foreground w-40'>Acceso</th>
                        </tr>
                      </thead>
                      <tbody className='divide-y'>
                        {items.map((item) => (
                          <tr key={item.id} className='hover:bg-muted/30 transition-colors'>
                            <td className='py-2 px-3'>
                              <div className='flex items-center gap-2'>
                                <span>{item.nombre}</span>
                                {item.esAccion && (
                                  <Badge variant='secondary' className='text-xs py-0 px-1.5'>
                                    Acción
                                  </Badge>
                                )}
                              </div>
                            </td>
                            <td className='py-2 px-3'>
                              <Select
                                value={getNivel(item.id)}
                                onValueChange={(v) => setNivel(item.id, v as NivelAcceso)}
                              >
                                <SelectTrigger className='h-7 text-xs w-36'>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {NIVEL_OPTIONS.map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value} className='text-xs'>
                                      {opt.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {sectionIndex < itemsBySection.size - 1 && <Separator className='mt-4' />}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Footer actions */}
      <div className='flex items-center gap-3 justify-end'>
        <Button
          type='button'
          variant='outline'
          onClick={() => router.push('/dashboard/configuracion/perfiles')}
        >
          Cancelar
        </Button>
        <Button
          type='submit'
          form='perfil-form'
          isLoading={isPending}
        >
          <Icons.check className='mr-2 h-4 w-4' />
          {isEdit ? 'Guardar cambios' : 'Crear perfil'}
        </Button>
      </div>
    </div>
  )
}
