'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
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
import { perfilesListOptions } from '@/features/perfiles/queries'
import { empresasListOptions } from '@/features/empresas/queries'
import { usuarioDetailOptions, usuariosKeys } from '../queries'
import { usuariosService } from '../service'
import { PasswordStrengthIndicator } from './password-strength-indicator'
import { AvatarUploadField } from './avatar-upload-field'
import type { Perfil } from '@/features/perfiles/types'

const usuarioBaseSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido').max(200).trim(),
  whatsapp: z.string().max(50).trim().optional().or(z.literal('')),
  perfilId: z.coerce.number().int().min(1, 'El perfil es requerido'),
  esResponsableVenta: z.boolean(),
  // Multi-empresa (Fase 4b): empresas asignadas + predeterminada. Invariante
  // §2 de empresas.md (la predeterminada debe estar entre las asignadas) se
  // valida con .refine() en cada schema final, no acá — .extend() no está
  // disponible sobre el resultado de .refine().
  empresas: z.array(z.number().int().positive()).default([]),
  empresaPredeterminadaId: z.number().int().positive().nullable().optional(),
})

const usuarioCreateSchema = usuarioBaseSchema
  .extend({
    email: z.string().email('Email inválido').max(200).trim(),
    password: z.string().min(1, 'La contraseña es requerida'),
    passwordConfirm: z.string().min(1, 'Confirma la contraseña'),
  })
  .refine(
    (data) => data.empresaPredeterminadaId == null || data.empresas.includes(data.empresaPredeterminadaId),
    { message: 'La empresa predeterminada debe estar entre las empresas asignadas', path: ['empresaPredeterminadaId'] },
  )

const usuarioEditSchema = usuarioBaseSchema.refine(
  (data) => data.empresaPredeterminadaId == null || data.empresas.includes(data.empresaPredeterminadaId),
  { message: 'La empresa predeterminada debe estar entre las empresas asignadas', path: ['empresaPredeterminadaId'] },
)

type UsuarioCreateValues = z.infer<typeof usuarioCreateSchema>
type UsuarioEditValues = z.infer<typeof usuarioEditSchema>

interface EmpresaAsignable {
  id: number
  razonSocial: string
  activo: boolean
}

interface UsuarioFormProps {
  usuarioId?: string
}

export function UsuarioForm({ usuarioId }: UsuarioFormProps) {
  const isEdit = !!usuarioId
  const router = useRouter()
  const queryClient = useQueryClient()
  const [passwordValue, setPasswordValue] = useState('')

  const { data: usuario, isLoading: loadingUsuario } = useQuery(
    usuarioDetailOptions(usuarioId ?? '')
  )

  const { data: perfilesData, isLoading: loadingPerfiles } = useQuery(
    perfilesListOptions({ limit: 200 })
  )
  const perfiles = (perfilesData?.data ?? []) as Perfil[]

  const { data: empresasData, isLoading: loadingEmpresas } = useQuery(
    empresasListOptions({ activo: true, limit: 200 })
  )
  // Solo empresas activas pueden agregarse, pero una empresa ya asignada que
  // luego se desactivó se sigue mostrando (atenuada) para no perder el dato
  // ni forzar una desasignación silenciosa.
  const empresasAsignables: EmpresaAsignable[] = useMemo(() => {
    const activas = empresasData?.data ?? []
    const inactivasAsignadas = (usuario?.empresas ?? []).filter((e) => !e.activo)
    return [...activas, ...inactivasAsignadas]
      .sort((a, b) => a.razonSocial.localeCompare(b.razonSocial))
  }, [empresasData, usuario])

  const createMutation = useMutation({
    mutationFn: (values: UsuarioCreateValues) =>
      usuariosService.create({
        nombre: values.nombre,
        email: values.email,
        whatsapp: values.whatsapp || undefined,
        perfilId: values.perfilId,
        esResponsableVenta: values.esResponsableVenta,
        password: values.password,
        passwordConfirm: values.passwordConfirm,
        empresas: values.empresas,
        empresaPredeterminadaId: values.empresaPredeterminadaId ?? null,
      }),
    onSuccess: () => {
      toast.success('Usuario creado correctamente')
      queryClient.invalidateQueries({ queryKey: usuariosKeys.all })
      router.push('/dashboard/configuracion/usuarios')
    },
    onError: (e: Error) => toast.error(e.message || 'Error al crear el usuario'),
  })

  const updateMutation = useMutation({
    mutationFn: (values: UsuarioEditValues) =>
      usuariosService.update(usuarioId!, {
        nombre: values.nombre,
        whatsapp: values.whatsapp || null,
        perfilId: values.perfilId,
        esResponsableVenta: values.esResponsableVenta,
        empresas: values.empresas,
        empresaPredeterminadaId: values.empresaPredeterminadaId ?? null,
      }),
    onSuccess: () => {
      toast.success('Usuario actualizado correctamente')
      queryClient.invalidateQueries({ queryKey: usuariosKeys.all })
      queryClient.invalidateQueries({ queryKey: usuariosKeys.detail(usuarioId!) })
      router.push('/dashboard/configuracion/usuarios')
    },
    onError: (e: Error) => toast.error(e.message || 'Error al actualizar el usuario'),
  })

  const isPending = createMutation.isPending || updateMutation.isPending

  // ---------- Create form ----------
  const createForm = useAppForm({
    defaultValues: {
      nombre: '',
      email: '',
      whatsapp: '',
      perfilId: 0,
      esResponsableVenta: false,
      password: '',
      passwordConfirm: '',
      empresas: [],
      empresaPredeterminadaId: null,
    } as UsuarioCreateValues,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    validators: { onSubmit: usuarioCreateSchema as any },
    onSubmit: async ({ value }) => {
      await createMutation.mutateAsync(value)
    },
  })

  // ---------- Edit form ----------
  const editForm = useAppForm({
    defaultValues: {
      nombre: usuario?.nombre ?? '',
      whatsapp: usuario?.whatsapp ?? '',
      perfilId: usuario?.perfilId ?? 0,
      esResponsableVenta: usuario?.esResponsableVenta ?? false,
      empresas: usuario?.empresas.map((e) => e.id) ?? [],
      empresaPredeterminadaId: usuario?.empresaPredeterminadaId ?? null,
    } as UsuarioEditValues,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    validators: { onSubmit: usuarioEditSchema as any },
    onSubmit: async ({ value }) => {
      await updateMutation.mutateAsync(value)
    },
  })

  useEffect(() => {
    if (usuario) {
      editForm.setFieldValue('nombre', usuario.nombre)
      editForm.setFieldValue('whatsapp', usuario.whatsapp ?? '')
      editForm.setFieldValue('perfilId', usuario.perfilId)
      editForm.setFieldValue('esResponsableVenta', usuario.esResponsableVenta)
      editForm.setFieldValue('empresas', usuario.empresas.map((e) => e.id))
      editForm.setFieldValue('empresaPredeterminadaId', usuario.empresaPredeterminadaId)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario])

  const isLoading = (isEdit && loadingUsuario) || loadingPerfiles || loadingEmpresas

  if (isLoading) {
    return (
      <div className='space-y-4'>
        <div className='animate-pulse h-10 bg-muted rounded' />
        <div className='animate-pulse h-10 bg-muted rounded' />
        <div className='animate-pulse h-10 bg-muted rounded' />
      </div>
    )
  }

  if (isEdit) {
    return (
      <div className='space-y-6'>
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>Datos del Usuario</CardTitle>
          </CardHeader>
          <CardContent>
            <editForm.AppForm>
              <editForm.Form id='usuario-edit-form' className='grid gap-4 sm:grid-cols-2 p-0 m-0'>
                {/* Nombre */}
                <editForm.Field name='nombre'>
                  {(field) => (
                    <div className='space-y-1.5'>
                      <Label htmlFor='nombre'>Nombre <span className='text-destructive'>*</span></Label>
                      <Input
                        id='nombre'
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder='Ej: Juan Pérez'
                      />
                      {field.state.meta.errors.length > 0 && (
                        <p className='text-sm text-destructive'>{String(field.state.meta.errors[0])}</p>
                      )}
                    </div>
                  )}
                </editForm.Field>

                {/* Email - readonly en edición */}
                <div className='space-y-1.5'>
                  <Label>Usuario (email)</Label>
                  <Input value={usuario?.email ?? ''} disabled className='bg-muted' />
                  <p className='text-xs text-muted-foreground'>El email no puede modificarse.</p>
                </div>

                {/* WhatsApp */}
                <editForm.Field name='whatsapp'>
                  {(field) => (
                    <div className='space-y-1.5'>
                      <Label htmlFor='whatsapp'>WhatsApp</Label>
                      <Input
                        id='whatsapp'
                        value={field.state.value ?? ''}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder='+56 9 1234 5678'
                      />
                    </div>
                  )}
                </editForm.Field>

                {/* Avatar */}
                <div className='space-y-1.5 sm:col-span-2'>
                  <Label>Avatar</Label>
                  <AvatarUploadField usuarioId={usuarioId!} nombre={usuario?.nombre ?? ''} imagenUrl={usuario?.imagenUrl ?? null} />
                </div>

                {/* Perfil */}
                <editForm.Field name='perfilId'>
                  {(field) => (
                    <div className='space-y-1.5 sm:col-span-2'>
                      <Label>Perfil <span className='text-destructive'>*</span></Label>
                      <Select
                        value={field.state.value ? String(field.state.value) : ''}
                        onValueChange={(v) => field.handleChange(parseInt(v, 10))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder='Seleccionar perfil...' />
                        </SelectTrigger>
                        <SelectContent>
                          {perfiles.map((p) => (
                            <SelectItem key={p.id} value={String(p.id)}>
                              {p.descripcion}
                              <span className='text-muted-foreground text-xs ml-1.5'>({p.codigo})</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {field.state.meta.errors.length > 0 && (
                        <p className='text-sm text-destructive'>{String(field.state.meta.errors[0])}</p>
                      )}
                    </div>
                  )}
                </editForm.Field>

                {/* Responsable de Venta */}
                <editForm.Field name='esResponsableVenta'>
                  {(field) => (
                    <div className='flex items-center gap-2 sm:col-span-2'>
                      <Checkbox
                        id='esResponsableVenta-edit'
                        checked={field.state.value}
                        onCheckedChange={(v) => field.handleChange(v === true)}
                      />
                      <Label htmlFor='esResponsableVenta-edit'>Responsable de Venta</Label>
                    </div>
                  )}
                </editForm.Field>

                {/* Empresas asignadas + predeterminada */}
                <div className='sm:col-span-2 space-y-4'>
                  <Separator />
                  <editForm.Field name='empresas'>
                    {(empresasField) => (
                      <div className='space-y-4'>
                        <div className='space-y-2'>
                          <Label>Empresas</Label>
                          {empresasAsignables.length === 0 ? (
                            <p className='text-sm text-muted-foreground'>No hay empresas disponibles.</p>
                          ) : (
                            empresasAsignables.map((emp) => (
                              <div key={emp.id} className='flex items-center gap-2'>
                                <Checkbox
                                  id={`empresa-${emp.id}-edit`}
                                  checked={empresasField.state.value.includes(emp.id)}
                                  onCheckedChange={(v) => {
                                    const checked = v === true
                                    const next = checked
                                      ? [...empresasField.state.value, emp.id]
                                      : empresasField.state.value.filter((id) => id !== emp.id)
                                    empresasField.handleChange(next)
                                    if (!checked && editForm.getFieldValue('empresaPredeterminadaId') === emp.id) {
                                      editForm.setFieldValue('empresaPredeterminadaId', null)
                                    }
                                  }}
                                />
                                <Label htmlFor={`empresa-${emp.id}-edit`} className='cursor-pointer font-normal flex items-center gap-1.5'>
                                  {emp.razonSocial}
                                  {!emp.activo && <Badge variant='outline' className='text-xs'>Inactiva</Badge>}
                                </Label>
                              </div>
                            ))
                          )}
                        </div>

                        <editForm.Field name='empresaPredeterminadaId'>
                          {(predField) => (
                            <div className='space-y-1.5'>
                              <Label>Empresa predeterminada</Label>
                              <Select
                                value={predField.state.value ? String(predField.state.value) : ''}
                                onValueChange={(v) => predField.handleChange(v ? parseInt(v, 10) : null)}
                                disabled={empresasField.state.value.length === 0}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder='Sin predeterminada' />
                                </SelectTrigger>
                                <SelectContent>
                                  {empresasAsignables
                                    .filter((e) => empresasField.state.value.includes(e.id))
                                    .map((e) => (
                                      <SelectItem key={e.id} value={String(e.id)}>{e.razonSocial}</SelectItem>
                                    ))}
                                </SelectContent>
                              </Select>
                              {predField.state.meta.errors.length > 0 && (
                                <p className='text-sm text-destructive'>{String(predField.state.meta.errors[0])}</p>
                              )}
                            </div>
                          )}
                        </editForm.Field>
                      </div>
                    )}
                  </editForm.Field>
                </div>
              </editForm.Form>
            </editForm.AppForm>
          </CardContent>
        </Card>

        <div className='flex items-center gap-3 justify-end'>
          <Button type='button' variant='outline' onClick={() => router.push('/dashboard/configuracion/usuarios')}>
            Cancelar
          </Button>
          <Button type='submit' form='usuario-edit-form' isLoading={isPending}>
            <Icons.check className='mr-2 h-4 w-4' />
            Guardar cambios
          </Button>
        </div>
      </div>
    )
  }

  // ---- CREATE MODE ----
  return (
    <createForm.AppForm>
      <createForm.Form id='usuario-create-form' className='space-y-6'>
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>Datos del Usuario</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='grid gap-4 sm:grid-cols-2'>
              {/* Nombre */}
              <createForm.Field name='nombre'>
                {(field) => (
                  <div className='space-y-1.5'>
                    <Label>Nombre <span className='text-destructive'>*</span></Label>
                    <Input
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder='Ej: Juan Pérez'
                    />
                    {field.state.meta.errors.length > 0 && (
                      <p className='text-sm text-destructive'>{String(field.state.meta.errors[0])}</p>
                    )}
                  </div>
                )}
              </createForm.Field>

              {/* Email */}
              <createForm.Field name='email'>
                {(field) => (
                  <div className='space-y-1.5'>
                    <Label>Usuario (email) <span className='text-destructive'>*</span></Label>
                    <Input
                      type='email'
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder='usuario@agrosan.cl'
                    />
                    {field.state.meta.errors.length > 0 && (
                      <p className='text-sm text-destructive'>{String(field.state.meta.errors[0])}</p>
                    )}
                  </div>
                )}
              </createForm.Field>

              {/* WhatsApp */}
              <createForm.Field name='whatsapp'>
                {(field) => (
                  <div className='space-y-1.5'>
                    <Label>WhatsApp</Label>
                    <Input
                      value={field.state.value ?? ''}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder='+56 9 1234 5678'
                    />
                  </div>
                )}
              </createForm.Field>

              {/* Perfil */}
              <createForm.Field name='perfilId'>
                {(field) => (
                  <div className='space-y-1.5 sm:col-span-2'>
                    <Label>Perfil <span className='text-destructive'>*</span></Label>
                    <Select
                      value={field.state.value ? String(field.state.value) : ''}
                      onValueChange={(v) => field.handleChange(parseInt(v, 10))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder='Seleccionar perfil...' />
                      </SelectTrigger>
                      <SelectContent>
                        {perfiles.map((p) => (
                          <SelectItem key={p.id} value={String(p.id)}>
                            {p.descripcion}
                            <span className='text-muted-foreground text-xs ml-1.5'>({p.codigo})</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {field.state.meta.errors.length > 0 && (
                      <p className='text-sm text-destructive'>{String(field.state.meta.errors[0])}</p>
                    )}
                  </div>
                )}
              </createForm.Field>

              {/* Responsable de Venta */}
              <createForm.Field name='esResponsableVenta'>
                {(field) => (
                  <div className='flex items-center gap-2 sm:col-span-2'>
                    <Checkbox
                      id='esResponsableVenta-create'
                      checked={field.state.value}
                      onCheckedChange={(v) => field.handleChange(v === true)}
                    />
                    <Label htmlFor='esResponsableVenta-create'>Responsable de Venta</Label>
                  </div>
                )}
              </createForm.Field>
            </div>
          </CardContent>
        </Card>

        {/* Empresas asignadas + predeterminada */}
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>Empresas</CardTitle>
          </CardHeader>
          <CardContent>
            <createForm.Field name='empresas'>
              {(empresasField) => (
                <div className='space-y-4'>
                  <div className='space-y-2'>
                    {empresasAsignables.length === 0 ? (
                      <p className='text-sm text-muted-foreground'>No hay empresas disponibles.</p>
                    ) : (
                      empresasAsignables.map((emp) => (
                        <div key={emp.id} className='flex items-center gap-2'>
                          <Checkbox
                            id={`empresa-${emp.id}-create`}
                            checked={empresasField.state.value.includes(emp.id)}
                            onCheckedChange={(v) => {
                              const checked = v === true
                              const next = checked
                                ? [...empresasField.state.value, emp.id]
                                : empresasField.state.value.filter((id) => id !== emp.id)
                              empresasField.handleChange(next)
                              if (!checked && createForm.getFieldValue('empresaPredeterminadaId') === emp.id) {
                                createForm.setFieldValue('empresaPredeterminadaId', null)
                              }
                            }}
                          />
                          <Label htmlFor={`empresa-${emp.id}-create`} className='cursor-pointer font-normal flex items-center gap-1.5'>
                            {emp.razonSocial}
                            {!emp.activo && <Badge variant='outline' className='text-xs'>Inactiva</Badge>}
                          </Label>
                        </div>
                      ))
                    )}
                  </div>

                  <createForm.Field name='empresaPredeterminadaId'>
                    {(predField) => (
                      <div className='space-y-1.5 max-w-sm'>
                        <Label>Empresa predeterminada</Label>
                        <Select
                          value={predField.state.value ? String(predField.state.value) : ''}
                          onValueChange={(v) => predField.handleChange(v ? parseInt(v, 10) : null)}
                          disabled={empresasField.state.value.length === 0}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder='Sin predeterminada' />
                          </SelectTrigger>
                          <SelectContent>
                            {empresasAsignables
                              .filter((e) => empresasField.state.value.includes(e.id))
                              .map((e) => (
                                <SelectItem key={e.id} value={String(e.id)}>{e.razonSocial}</SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        {predField.state.meta.errors.length > 0 && (
                          <p className='text-sm text-destructive'>{String(predField.state.meta.errors[0])}</p>
                        )}
                      </div>
                    )}
                  </createForm.Field>
                </div>
              )}
            </createForm.Field>
          </CardContent>
        </Card>

        {/* Password section */}
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>Contraseña</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='grid gap-4 sm:grid-cols-2'>
              <createForm.Field name='password'>
                {(field) => (
                  <div className='space-y-1.5'>
                    <Label>Contraseña <span className='text-destructive'>*</span></Label>
                    <Input
                      type='password'
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => {
                        field.handleChange(e.target.value)
                        setPasswordValue(e.target.value)
                      }}
                      placeholder='••••••••'
                    />
                    {field.state.meta.errors.length > 0 && (
                      <p className='text-sm text-destructive'>{String(field.state.meta.errors[0])}</p>
                    )}
                    <PasswordStrengthIndicator password={passwordValue} />
                  </div>
                )}
              </createForm.Field>

              <createForm.Field name='passwordConfirm'>
                {(field) => (
                  <div className='space-y-1.5'>
                    <Label>Confirmar contraseña <span className='text-destructive'>*</span></Label>
                    <Input
                      type='password'
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder='••••••••'
                    />
                    {field.state.meta.errors.length > 0 && (
                      <p className='text-sm text-destructive'>{String(field.state.meta.errors[0])}</p>
                    )}
                  </div>
                )}
              </createForm.Field>
            </div>
          </CardContent>
        </Card>

        <div className='flex items-center gap-3 justify-end'>
          <Button type='button' variant='outline' onClick={() => router.push('/dashboard/configuracion/usuarios')}>
            Cancelar
          </Button>
          <Button type='submit' isLoading={isPending}>
            <Icons.check className='mr-2 h-4 w-4' />
            Crear usuario
          </Button>
        </div>
      </createForm.Form>
    </createForm.AppForm>
  )
}
