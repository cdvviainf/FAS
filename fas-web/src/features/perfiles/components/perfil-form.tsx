'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
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
import { Switch } from '@/components/ui/switch'
import { useAppForm, useFormFields } from '@/components/ui/tanstack-form'
import { itemsMenuOptions, perfilDetailOptions, perfilesKeys } from '../queries'
import { perfilesService } from '../service'
import { prefijosCodigoService } from '@/features/prefijos-codigo/service'
import type { NivelAcceso, ItemMenu } from '../types'

const perfilSchema = z.object({
  codigo: z.string().min(1, 'El código es requerido').max(50).trim(),
  descripcion: z.string().min(1, 'La descripción es requerida').max(200).trim(),
})

type PerfilFormValues = z.infer<typeof perfilSchema>

// Orden del select de niveles para pantallas (Total → Lectura → Sin Acceso).
const NIVEL_OPTIONS: { value: NivelAcceso; label: string }[] = [
  { value: 'TOTAL', label: 'Total' },
  { value: 'LECTURA', label: 'Lectura' },
  { value: 'SIN_ACCESO', label: 'Sin Acceso' },
]

// Nivel que concede un toggle "Sí" según el tipo de ítem: una acción exige
// TOTAL; un reporte es de solo consulta (LECTURA). "No" = SIN_ACCESO.
function nivelBinarioActivo(tipo: ItemMenu['tipo']): NivelAcceso {
  return tipo === 'REPORTE' ? 'LECTURA' : 'TOTAL'
}

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

  // Agrupa por grupo → sección preservando el orden del backend (ordenado por
  // `orden` global): la matriz refleja la jerarquía del menú.
  const itemsByGrupo = useMemo(() => {
    const map = new Map<string, Map<string, ItemMenu[]>>()
    if (!itemsMenu) return map
    for (const item of itemsMenu) {
      if (!map.has(item.grupo)) map.set(item.grupo, new Map())
      const secciones = map.get(item.grupo)!
      if (!secciones.has(item.seccion)) secciones.set(item.seccion, [])
      secciones.get(item.seccion)!.push(item)
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
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAccesosMap(map)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfilData])

  // Sugerencia de código (Prefijos de Código) — solo al crear.
  const { data: codigoSugerido } = useQuery({
    queryKey: ['prefijo-codigo-siguiente', 'perfil'],
    queryFn: () => prefijosCodigoService.siguienteCodigo('perfil'),
    enabled: !isEdit,
    staleTime: 0,
  })

  useEffect(() => {
    if (!isEdit && codigoSugerido) form.setFieldValue('codigo', codigoSugerido)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codigoSugerido, isEdit])

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
          {itemsByGrupo.size === 0 ? (
            <p className='text-sm text-muted-foreground py-4 text-center'>
              No hay ítems de menú configurados.
            </p>
          ) : (
            <div className='space-y-6'>
              {Array.from(itemsByGrupo.entries()).map(([grupo, secciones], grupoIndex) => (
                <div key={grupo} className='space-y-3'>
                  <h3 className='text-sm font-bold tracking-wide'>{grupo}</h3>
                  {Array.from(secciones.entries()).map(([seccion, items]) => (
                    <div key={seccion}>
                      {seccion !== grupo && (
                        <h4 className='text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2'>
                          {seccion}
                        </h4>
                      )}
                      <div className='rounded-md border overflow-hidden'>
                        <table className='w-full text-sm'>
                          <thead className='bg-muted/50'>
                            <tr>
                              <th className='text-left py-2 px-3 font-medium text-xs text-muted-foreground'>Ítem</th>
                              <th className='text-left py-2 px-3 font-medium text-xs text-muted-foreground w-40'>Acceso</th>
                            </tr>
                          </thead>
                          <tbody className='divide-y'>
                            {items.map((item) => {
                              const binario = item.tipo !== 'PANTALLA'
                              const nivel = getNivel(item.id)
                              return (
                                <tr key={item.id} className='hover:bg-muted/30 transition-colors'>
                                  <td className='py-2 px-3'>
                                    <div className='flex items-center gap-2'>
                                      <span>{item.nombre}</span>
                                      {item.tipo === 'ACCION' && (
                                        <Badge variant='secondary' className='text-xs py-0 px-1.5'>Acción</Badge>
                                      )}
                                      {item.tipo === 'REPORTE' && (
                                        <Badge variant='outline' className='text-xs py-0 px-1.5'>Reporte</Badge>
                                      )}
                                    </div>
                                  </td>
                                  <td className='py-2 px-3'>
                                    {binario ? (
                                      <div className='flex items-center gap-2'>
                                        <Switch
                                          checked={nivel !== 'SIN_ACCESO'}
                                          onCheckedChange={(on) =>
                                            setNivel(item.id, on ? nivelBinarioActivo(item.tipo) : 'SIN_ACCESO')
                                          }
                                        />
                                        <span className='text-xs text-muted-foreground'>
                                          {nivel !== 'SIN_ACCESO' ? 'Sí' : 'No'}
                                        </span>
                                      </div>
                                    ) : (
                                      <Select value={nivel} onValueChange={(v) => setNivel(item.id, v as NivelAcceso)}>
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
                                    )}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                  {grupoIndex < itemsByGrupo.size - 1 && <Separator className='mt-4' />}
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
