'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { AlertModal } from '@/components/modal/alert-modal'
import { GeoPasteButton } from '@/components/shared/geo-paste-button'
import { Combobox } from '@/components/ui/combobox'
import { Icons } from '@/components/icons'
import { ComunaQuickCreate } from '@/features/comunas/components/comuna-quick-create'
import { useEmpresa } from '@/contexts/empresa-context'
import { SmtpConfigForm } from '@/features/configuracion-general/components/smtp-config-form'
import { LogoUploadField } from './logo-upload-field'
import { empresaDetailOptions, empresasKeys, empresasPaisesOptions, empresasComunasOptions } from '../queries'
import { empresasService } from '../service'
import type {
  EmpresaCreateInput,
  DireccionCreateInput,
  ContactoCreateInput,
  DireccionItem,
  ContactoItem,
} from '../types'

// Mapea cada campo validado a la pestaña donde vive su input, para poder saltar
// automáticamente a la pestaña con el primer error (mismo patrón que EntidadForm).
const FIELD_TAB: Record<string, 'empresa' | 'direcciones' | 'contactos'> = {
  codigo: 'empresa',
  razonSocial: 'empresa',
  email: 'empresa',
  direcciones: 'direcciones',
  direccionesPorDefecto: 'direcciones',
}

function validarRutChileno(rut: string): boolean {
  const clean = rut.replace(/[.\-\s]/g, '').toUpperCase()
  if (!/^\d{7,8}[0-9K]$/.test(clean)) return false
  const body = clean.slice(0, -1)
  const dv = clean.slice(-1)
  let sum = 0
  let mult = 2
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i]) * mult
    mult = mult === 7 ? 2 : mult + 1
  }
  const expected = 11 - (sum % 11)
  const expectedStr = expected === 11 ? '0' : expected === 10 ? 'K' : String(expected)
  return dv === expectedStr
}

// ─── Dialog de Dirección ──────────────────────────────────────────────────────

interface DireccionDialogProps {
  open: boolean
  initial?: Partial<DireccionCreateInput> & { id?: number }
  paisOrigen: number | null
  onClose: () => void
  onSave: (data: DireccionCreateInput & { id?: number }) => Promise<void>
  isSaving: boolean
  paises: { id: number; descripcion: string; esPaisNacional: boolean }[]
  comunas: { id: number; descripcion: string }[]
}

function DireccionDialog({ open, initial, paisOrigen, onClose, onSave, isSaving, paises, comunas }: DireccionDialogProps) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<DireccionCreateInput>({
    codigo: '',
    descripcion: '',
    paisId: paisOrigen ?? 0,
    comunaId: null,
    direccion: '',
    esPorDefecto: false,
    latitud: null,
    longitud: null,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm({
        codigo: initial?.codigo ?? '',
        descripcion: initial?.descripcion ?? '',
        paisId: initial?.paisId ?? paisOrigen ?? (paises[0]?.id ?? 0),
        comunaId: initial?.comunaId ?? null,
        direccion: initial?.direccion ?? '',
        esPorDefecto: initial?.esPorDefecto ?? false,
        latitud: initial?.latitud ?? null,
        longitud: initial?.longitud ?? null,
      })
      setErrors({})
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const selectedPaisEsChile = form.paisId === paisOrigen

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!form.codigo.trim()) e.codigo = 'El código es requerido'
    if (!form.descripcion.trim()) e.descripcion = 'La descripción es requerida'
    if (!form.direccion.trim()) e.direccion = 'La dirección es requerida'
    if (!form.paisId) e.paisId = 'El país es requerido'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit() {
    if (!validate()) return
    await onSave({ ...form, id: initial?.id })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className='max-w-lg'>
        <DialogHeader>
          <DialogTitle>{initial?.id ? 'Editar Dirección' : 'Nueva Dirección'}</DialogTitle>
        </DialogHeader>
        <div className='grid gap-4 py-2'>
          <div className='grid grid-cols-2 gap-3'>
            <div className='space-y-1.5'>
              <Label>Código <span className='text-destructive'>*</span></Label>
              <Input
                value={form.codigo}
                onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value }))}
                placeholder='PPAL'
              />
              {errors.codigo && <p className='text-xs text-destructive'>{errors.codigo}</p>}
            </div>
            <div className='space-y-1.5'>
              <Label>País <span className='text-destructive'>*</span></Label>
              <Select
                value={form.paisId ? String(form.paisId) : ''}
                onValueChange={(v) => setForm((f) => ({ ...f, paisId: parseInt(v), comunaId: null }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder='País...' />
                </SelectTrigger>
                <SelectContent>
                  {paises.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.descripcion}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.paisId && <p className='text-xs text-destructive'>{errors.paisId}</p>}
            </div>
          </div>
          <div className='space-y-1.5'>
            <Label>Descripción <span className='text-destructive'>*</span></Label>
            <Input
              value={form.descripcion}
              onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
              placeholder='Ej: Casa matriz, Bodega Norte'
            />
            {errors.descripcion && <p className='text-xs text-destructive'>{errors.descripcion}</p>}
          </div>
          <div className='space-y-1.5'>
            <Label>Dirección <span className='text-destructive'>*</span></Label>
            <Input
              value={form.direccion}
              onChange={(e) => setForm((f) => ({ ...f, direccion: e.target.value }))}
              placeholder='Ej: Av. Los Leones 1234, Providencia'
            />
            {errors.direccion && <p className='text-xs text-destructive'>{errors.direccion}</p>}
          </div>
          {selectedPaisEsChile && (
            <div className='space-y-1.5'>
              <Label>Comuna</Label>
              <div className='flex gap-2'>
                <Combobox
                  className='flex-1'
                  value={form.comunaId ? String(form.comunaId) : ''}
                  onChange={(v) => setForm((f) => ({ ...f, comunaId: parseInt(v) }))}
                  placeholder='Seleccionar comuna...'
                  searchPlaceholder='Buscar comuna...'
                  options={comunas.map((c) => ({ value: String(c.id), label: c.descripcion }))}
                />
                <ComunaQuickCreate
                  onCreated={(nuevaComuna) => {
                    queryClient.invalidateQueries({ queryKey: empresasKeys.comunas })
                    setForm((f) => ({ ...f, comunaId: nuevaComuna.id }))
                  }}
                />
              </div>
              {errors.comunaId && <p className='text-xs text-destructive'>{errors.comunaId}</p>}
            </div>
          )}
          <div className='flex items-center justify-between'>
            <Label className='text-sm font-medium text-muted-foreground'>Coordenadas (opcional)</Label>
            <GeoPasteButton
              onPegado={({ lat, lng }) => setForm((f) => ({ ...f, latitud: lat, longitud: lng }))}
            />
          </div>
          <div className='grid grid-cols-2 gap-3'>
            <div className='space-y-1.5'>
              <Label>Latitud</Label>
              <Input
                type='number'
                step='any'
                value={form.latitud ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, latitud: e.target.value === '' ? null : parseFloat(e.target.value) }))}
                placeholder='-33.4489'
              />
            </div>
            <div className='space-y-1.5'>
              <Label>Longitud</Label>
              <Input
                type='number'
                step='any'
                value={form.longitud ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, longitud: e.target.value === '' ? null : parseFloat(e.target.value) }))}
                placeholder='-70.6693'
              />
            </div>
          </div>
          <div className='flex items-center gap-2'>
            <Switch
              id='esPorDefecto-dir'
              checked={form.esPorDefecto}
              onCheckedChange={(v) => setForm((f) => ({ ...f, esPorDefecto: v }))}
            />
            <Label htmlFor='esPorDefecto-dir'>Dirección por defecto</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant='outline' onClick={onClose} disabled={isSaving}>Cancelar</Button>
          <Button onClick={handleSubmit} isLoading={isSaving}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Dialog de Contacto ───────────────────────────────────────────────────────

interface ContactoDialogProps {
  open: boolean
  initial?: Partial<ContactoCreateInput> & { id?: number }
  onClose: () => void
  onSave: (data: ContactoCreateInput & { id?: number }) => Promise<void>
  isSaving: boolean
}

function ContactoDialog({ open, initial, onClose, onSave, isSaving }: ContactoDialogProps) {
  const [form, setForm] = useState<ContactoCreateInput>({
    codigo: '',
    nombre: '',
    rut: '',
    whatsapp: '',
    email: '',
    telefono: '',
    tipo: '',
    esRepresentanteLegal: false,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm({
        codigo: initial?.codigo ?? '',
        nombre: initial?.nombre ?? '',
        rut: initial?.rut ?? '',
        whatsapp: initial?.whatsapp ?? '',
        email: initial?.email ?? '',
        telefono: initial?.telefono ?? '',
        tipo: initial?.tipo ?? '',
        esRepresentanteLegal: initial?.esRepresentanteLegal ?? false,
      })
      setErrors({})
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!form.codigo.trim()) e.codigo = 'El código es requerido'
    if (!form.nombre.trim()) e.nombre = 'El nombre es requerido'
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Email inválido'
    if (form.esRepresentanteLegal) {
      if (!form.rut?.trim()) {
        e.rut = 'El RUT es requerido para el representante legal'
      } else if (!validarRutChileno(form.rut.trim())) {
        e.rut = 'RUT inválido'
      }
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit() {
    if (!validate()) return
    await onSave({
      codigo: form.codigo.trim(),
      nombre: form.nombre.trim(),
      rut: form.rut?.trim() || undefined,
      whatsapp: form.whatsapp?.trim() || undefined,
      email: form.email?.trim() || undefined,
      telefono: form.telefono?.trim() || undefined,
      tipo: form.tipo?.trim() || undefined,
      esRepresentanteLegal: form.esRepresentanteLegal,
      id: initial?.id,
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className='max-w-lg'>
        <DialogHeader>
          <DialogTitle>{initial?.id ? 'Editar Contacto' : 'Nuevo Contacto'}</DialogTitle>
        </DialogHeader>
        <div className='grid gap-4 py-2'>
          <div className='grid grid-cols-2 gap-3'>
            <div className='space-y-1.5'>
              <Label>Código <span className='text-destructive'>*</span></Label>
              <Input
                value={form.codigo}
                onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value }))}
                placeholder='CONT1'
              />
              {errors.codigo && <p className='text-xs text-destructive'>{errors.codigo}</p>}
            </div>
            <div className='space-y-1.5'>
              <Label>Tipo</Label>
              <Input
                value={form.tipo ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))}
                placeholder='Ej: Ventas, Finanzas...'
              />
            </div>
          </div>
          <div className='space-y-1.5'>
            <Label>Nombre <span className='text-destructive'>*</span></Label>
            <Input
              value={form.nombre}
              onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
              placeholder='Nombre completo'
            />
            {errors.nombre && <p className='text-xs text-destructive'>{errors.nombre}</p>}
          </div>
          <div className='grid grid-cols-2 gap-3'>
            <div className='space-y-1.5'>
              <Label>Teléfono</Label>
              <Input
                value={form.telefono ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))}
                placeholder='+56 9 1234 5678'
              />
            </div>
            <div className='space-y-1.5'>
              <Label>WhatsApp</Label>
              <Input
                value={form.whatsapp ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, whatsapp: e.target.value }))}
                placeholder='+56 9 1234 5678'
              />
            </div>
          </div>
          <div className='space-y-1.5'>
            <Label>Email</Label>
            <Input
              type='email'
              value={form.email ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder='contacto@empresa.cl'
            />
            {errors.email && <p className='text-xs text-destructive'>{errors.email}</p>}
          </div>
          <div className='flex items-center gap-2'>
            <Switch
              id='esRepLegal'
              checked={form.esRepresentanteLegal}
              onCheckedChange={(v) => setForm((f) => ({ ...f, esRepresentanteLegal: v }))}
            />
            <Label htmlFor='esRepLegal'>Es Representante Legal</Label>
          </div>
          {form.esRepresentanteLegal && (
            <div className='space-y-1.5'>
              <Label>RUT <span className='text-destructive'>*</span></Label>
              <Input
                value={form.rut ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, rut: e.target.value }))}
                placeholder='12.345.678-9'
              />
              {errors.rut && <p className='text-xs text-destructive'>{errors.rut}</p>}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant='outline' onClick={onClose} disabled={isSaving}>Cancelar</Button>
          <Button onClick={handleSubmit} isLoading={isSaving}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Base fields ──────────────────────────────────────────────────────────────

interface BaseFields {
  codigo: string
  razonSocial: string
  nombreFantasia: string
  rut: string
  giro: string
  email: string
  telefono: string
  activo: boolean
}

// ─── Main Form ────────────────────────────────────────────────────────────────

interface EmpresaFormProps {
  empresaId?: number
}

export function EmpresaForm({ empresaId }: EmpresaFormProps) {
  const isEdit = !!empresaId
  const router = useRouter()
  const queryClient = useQueryClient()
  const { empresaActiva } = useEmpresa()

  // ── Base fields ──
  const [fields, setFields] = useState<BaseFields>({
    codigo: '',
    razonSocial: '',
    nombreFantasia: '',
    rut: '',
    giro: '',
    email: '',
    telefono: '',
    activo: true,
  })
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [activeTab, setActiveTab] = useState<'empresa' | 'direcciones' | 'contactos' | 'logo' | 'smtp'>('empresa')

  // ── Sub-listas (para create: local state; para edit: desde API) ──
  const [localDirecciones, setLocalDirecciones] = useState<(DireccionCreateInput & { _localId: number })[]>([])
  const [localContactos, setLocalContactos] = useState<(ContactoCreateInput & { _localId: number })[]>([])
  const [localIdCounter, setLocalIdCounter] = useState(0)

  // ── Dialogs ──
  const [dirDialog, setDirDialog] = useState<{ open: boolean; initial?: Partial<DireccionCreateInput> & { id?: number }; localId?: number }>({ open: false })
  const [conDialog, setConDialog] = useState<{ open: boolean; initial?: Partial<ContactoCreateInput> & { id?: number }; localId?: number }>({ open: false })
  const [deleteDir, setDeleteDir] = useState<{ open: boolean; id?: number; localId?: number }>({ open: false })
  const [deleteCon, setDeleteCon] = useState<{ open: boolean; id?: number; localId?: number }>({ open: false })
  const [savingDir, setSavingDir] = useState(false)
  const [savingCon, setSavingCon] = useState(false)
  const [deletingDir, setDeletingDir] = useState(false)
  const [deletingCon, setDeletingCon] = useState(false)

  // ── Queries ──
  const { data: paisesData } = useQuery(empresasPaisesOptions())
  const { data: comunasData } = useQuery(empresasComunasOptions())
  const { data: empresa, isLoading } = useQuery({
    ...empresaDetailOptions(empresaId ?? 0),
    enabled: isEdit,
  })

  const paises = paisesData?.data ?? []
  const comunas = comunasData?.data ?? []
  const paisOrigen = paises.find((p) => p.esPaisNacional)?.id ?? null

  // ── Load existing entity ──
  useEffect(() => {
    if (empresa) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFields({
        codigo: empresa.codigo,
        razonSocial: empresa.razonSocial,
        nombreFantasia: empresa.nombreFantasia ?? '',
        rut: empresa.rut ?? '',
        giro: empresa.giro ?? '',
        email: empresa.email ?? '',
        telefono: empresa.telefono ?? '',
        activo: empresa.activo,
      })
    }
  }, [empresa])

  // ── Validation ──
  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!fields.codigo.trim()) e.codigo = 'El código es requerido'
    if (!fields.razonSocial.trim()) e.razonSocial = 'La razón social es requerida'
    if (fields.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) e.email = 'Email inválido'
    if (!isEdit && !localDirecciones.some((d) => d.esPorDefecto) && localDirecciones.length > 0) {
      e.direccionesPorDefecto = 'Una dirección debe ser la principal'
    }
    setFieldErrors(e)
    const firstErrorField = Object.keys(e)[0]
    if (firstErrorField) {
      setActiveTab(FIELD_TAB[firstErrorField] ?? 'empresa')
    }
    return Object.keys(e).length === 0
  }

  // ── Mutations ──
  const createMutation = useMutation({
    // Empresa + direcciones + contactos viajan en un único POST: el backend
    // los crea en una sola transacción Prisma (evita dejar un código
    // "quemado" por soft-delete si un hijo fallara a mitad de camino).
    mutationFn: (base: EmpresaCreateInput) => empresasService.create(base),
    onSuccess: () => {
      toast.success('Empresa creada correctamente')
      queryClient.invalidateQueries({ queryKey: empresasKeys.all })
      queryClient.invalidateQueries({ queryKey: ['config', 'me', 'empresas'] })
      router.push('/dashboard/configuracion/empresas')
    },
    onError: (e: Error) => toast.error(e.message || 'Error al crear la empresa'),
  })

  const updateMutation = useMutation({
    mutationFn: (data: Partial<EmpresaCreateInput>) => empresasService.update(empresaId!, data),
    onSuccess: () => {
      toast.success('Empresa actualizada correctamente')
      queryClient.invalidateQueries({ queryKey: empresasKeys.all })
      queryClient.invalidateQueries({ queryKey: empresasKeys.detail(empresaId!) })
      queryClient.invalidateQueries({ queryKey: ['config', 'me', 'empresas'] })
      router.push('/dashboard/configuracion/empresas')
    },
    onError: (e: Error) => toast.error(e.message || 'Error al actualizar la empresa'),
  })

  function handleSubmit() {
    if (!validate()) {
      toast.error('Hay campos por corregir — revisa la pestaña marcada con el punto rojo')
      return
    }

    const payload: EmpresaCreateInput = {
      codigo: fields.codigo.trim(),
      razonSocial: fields.razonSocial.trim(),
      nombreFantasia: fields.nombreFantasia.trim() || undefined,
      rut: fields.rut.trim() || undefined,
      giro: fields.giro.trim() || undefined,
      email: fields.email.trim() || undefined,
      telefono: fields.telefono.trim() || undefined,
      activo: fields.activo,
    }

    if (isEdit) {
      updateMutation.mutate(payload)
    } else {
      createMutation.mutate({
        ...payload,
        direcciones: localDirecciones.map((dir) => ({
          codigo: dir.codigo,
          descripcion: dir.descripcion,
          paisId: dir.paisId,
          comunaId: dir.comunaId ?? undefined,
          direccion: dir.direccion,
          esPorDefecto: dir.esPorDefecto,
          latitud: dir.latitud ?? undefined,
          longitud: dir.longitud ?? undefined,
        })),
        contactos: localContactos.map((con) => ({
          codigo: con.codigo,
          nombre: con.nombre,
          rut: con.rut || undefined,
          whatsapp: con.whatsapp || undefined,
          email: con.email || undefined,
          telefono: con.telefono || undefined,
          tipo: con.tipo || undefined,
          esRepresentanteLegal: con.esRepresentanteLegal,
        })),
      })
    }
  }

  // ── Dirección handlers (create mode: local; edit mode: API) ──
  const handleSaveDireccion = useCallback(async (data: DireccionCreateInput & { id?: number }) => {
    if (!isEdit) {
      if (dirDialog.localId !== undefined) {
        setLocalDirecciones((dirs) =>
          dirs.map((d) =>
            d._localId === dirDialog.localId ? { ...d, ...data } : d
          )
        )
      } else {
        const newId = localIdCounter
        setLocalIdCounter((n) => n + 1)
        setLocalDirecciones((dirs) => {
          const updated = data.esPorDefecto
            ? dirs.map((d) => ({ ...d, esPorDefecto: false }))
            : dirs
          return [...updated, { ...data, _localId: newId }]
        })
      }
      setDirDialog({ open: false })
      return
    }

    // Edit mode: call API
    setSavingDir(true)
    try {
      if (data.id) {
        await empresasService.updateDireccion(empresaId!, data.id, data)
      } else {
        await empresasService.createDireccion(empresaId!, data)
      }
      queryClient.invalidateQueries({ queryKey: empresasKeys.detail(empresaId!) })
      setDirDialog({ open: false })
      toast.success('Dirección guardada')
    } catch (e) {
      toast.error((e as Error).message || 'Error al guardar dirección')
    } finally {
      setSavingDir(false)
    }
  }, [isEdit, empresaId, dirDialog.localId, localIdCounter, queryClient])

  const handleDeleteDireccion = useCallback(async () => {
    if (!isEdit) {
      setLocalDirecciones((dirs) => dirs.filter((d) => d._localId !== deleteDir.localId))
      setDeleteDir({ open: false })
      return
    }
    setDeletingDir(true)
    try {
      await empresasService.deleteDireccion(empresaId!, deleteDir.id!)
      queryClient.invalidateQueries({ queryKey: empresasKeys.detail(empresaId!) })
      setDeleteDir({ open: false })
      toast.success('Dirección eliminada')
    } catch (e) {
      toast.error((e as Error).message || 'Error al eliminar dirección')
    } finally {
      setDeletingDir(false)
    }
  }, [isEdit, empresaId, deleteDir, queryClient])

  // ── Contacto handlers ──
  const handleSaveContacto = useCallback(async (data: ContactoCreateInput & { id?: number }) => {
    if (!isEdit) {
      if (conDialog.localId !== undefined) {
        setLocalContactos((cons) =>
          cons.map((c) => (c._localId === conDialog.localId ? { ...c, ...data } : c))
        )
      } else {
        const newId = localIdCounter
        setLocalIdCounter((n) => n + 1)
        setLocalContactos((cons) => [...cons, { ...data, _localId: newId }])
      }
      setConDialog({ open: false })
      return
    }
    setSavingCon(true)
    try {
      if (data.id) {
        await empresasService.updateContacto(empresaId!, data.id, data)
      } else {
        await empresasService.createContacto(empresaId!, data)
      }
      queryClient.invalidateQueries({ queryKey: empresasKeys.detail(empresaId!) })
      setConDialog({ open: false })
      toast.success('Contacto guardado')
    } catch (e) {
      toast.error((e as Error).message || 'Error al guardar contacto')
    } finally {
      setSavingCon(false)
    }
  }, [isEdit, empresaId, conDialog.localId, localIdCounter, queryClient])

  const handleDeleteContacto = useCallback(async () => {
    if (!isEdit) {
      setLocalContactos((cons) => cons.filter((c) => c._localId !== deleteCon.localId))
      setDeleteCon({ open: false })
      return
    }
    setDeletingCon(true)
    try {
      await empresasService.deleteContacto(empresaId!, deleteCon.id!)
      queryClient.invalidateQueries({ queryKey: empresasKeys.detail(empresaId!) })
      setDeleteCon({ open: false })
      toast.success('Contacto eliminado')
    } catch (e) {
      toast.error((e as Error).message || 'Error al eliminar contacto')
    } finally {
      setDeletingCon(false)
    }
  }, [isEdit, empresaId, deleteCon, queryClient])

  // ── Direcciones & contactos a mostrar ──
  const direccionesToShow: DireccionItem[] = isEdit
    ? (empresa?.direcciones ?? [])
    : localDirecciones.map((d) => ({
        id: d._localId,
        codigo: d.codigo,
        descripcion: d.descripcion,
        paisId: d.paisId,
        comunaId: d.comunaId ?? null,
        direccion: d.direccion,
        esPorDefecto: d.esPorDefecto,
        latitud: d.latitud ?? null,
        longitud: d.longitud ?? null,
        pais: paises.find((p) => p.id === d.paisId) ?? { id: d.paisId, codigo: '', descripcion: '' },
        comuna: d.comunaId ? (comunas.find((c) => c.id === d.comunaId) ?? null) : null,
      }))

  const contactosToShow: ContactoItem[] = isEdit
    ? (empresa?.contactos ?? [])
    : localContactos.map((c) => ({
        id: c._localId,
        codigo: c.codigo,
        nombre: c.nombre,
        rut: c.rut ?? null,
        whatsapp: c.whatsapp ?? null,
        email: c.email ?? null,
        telefono: c.telefono ?? null,
        tipo: c.tipo ?? null,
        esRepresentanteLegal: c.esRepresentanteLegal,
      }))

  const isPending = createMutation.isPending || updateMutation.isPending
  const esEmpresaActiva = isEdit && empresaActiva?.id === empresaId

  if (isEdit && isLoading) {
    return (
      <div className='space-y-4'>
        {[1, 2, 3].map((i) => <div key={i} className='animate-pulse h-10 bg-muted rounded' />)}
      </div>
    )
  }

  return (
    <div className='space-y-6'>
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList>
          <TabsTrigger value='empresa'>
            Empresa
            {Object.keys(fieldErrors).some((k) => FIELD_TAB[k] === 'empresa') && (
              <span className='ml-1.5 h-1.5 w-1.5 rounded-full bg-destructive' aria-label='Hay errores en esta pestaña' />
            )}
          </TabsTrigger>
          <TabsTrigger value='direcciones'>
            Direcciones
            {direccionesToShow.length > 0 && (
              <Badge variant='secondary' className='ml-1.5 h-5 px-1.5 text-xs'>{direccionesToShow.length}</Badge>
            )}
            {Object.keys(fieldErrors).some((k) => FIELD_TAB[k] === 'direcciones') && (
              <span className='ml-1.5 h-1.5 w-1.5 rounded-full bg-destructive' aria-label='Hay errores en esta pestaña' />
            )}
          </TabsTrigger>
          <TabsTrigger value='contactos'>
            Contactos
            {contactosToShow.length > 0 && (
              <Badge variant='secondary' className='ml-1.5 h-5 px-1.5 text-xs'>{contactosToShow.length}</Badge>
            )}
          </TabsTrigger>
          {isEdit && <TabsTrigger value='logo'>Logo</TabsTrigger>}
          {isEdit && <TabsTrigger value='smtp'>SMTP</TabsTrigger>}
        </TabsList>

        {/* ── Tab 1: Empresa ── */}
        <TabsContent value='empresa' className='mt-4 space-y-4'>
          <Card>
            <CardHeader>
              <CardTitle className='text-base'>Datos Generales</CardTitle>
            </CardHeader>
            <CardContent>
              <div className='grid gap-4 sm:grid-cols-2'>
                <div className='space-y-1.5'>
                  <Label>Código <span className='text-destructive'>*</span></Label>
                  <Input
                    value={fields.codigo}
                    onChange={(e) => setFields((f) => ({ ...f, codigo: e.target.value }))}
                    placeholder='Ej: AGROSAN'
                  />
                  {fieldErrors.codigo && <p className='text-xs text-destructive'>{fieldErrors.codigo}</p>}
                </div>
                <div className='space-y-1.5'>
                  <Label>RUT</Label>
                  <Input
                    value={fields.rut}
                    onChange={(e) => setFields((f) => ({ ...f, rut: e.target.value }))}
                    placeholder='76.XXX.XXX-X'
                  />
                </div>
                <div className='space-y-1.5 sm:col-span-2'>
                  <Label>Razón Social <span className='text-destructive'>*</span></Label>
                  <Input
                    value={fields.razonSocial}
                    onChange={(e) => setFields((f) => ({ ...f, razonSocial: e.target.value }))}
                    placeholder='Razón social legal completa'
                  />
                  {fieldErrors.razonSocial && <p className='text-xs text-destructive'>{fieldErrors.razonSocial}</p>}
                </div>
                <div className='space-y-1.5'>
                  <Label>Nombre de Fantasía</Label>
                  <Input
                    value={fields.nombreFantasia}
                    onChange={(e) => setFields((f) => ({ ...f, nombreFantasia: e.target.value }))}
                    placeholder='Nombre comercial'
                  />
                </div>
                <div className='space-y-1.5'>
                  <Label>Giro</Label>
                  <Input
                    value={fields.giro}
                    onChange={(e) => setFields((f) => ({ ...f, giro: e.target.value }))}
                    placeholder='Ej: Exportación de frutas'
                  />
                </div>
                <div className='space-y-1.5'>
                  <Label>Email</Label>
                  <Input
                    type='email'
                    value={fields.email}
                    onChange={(e) => setFields((f) => ({ ...f, email: e.target.value }))}
                    placeholder='contacto@empresa.cl'
                  />
                  {fieldErrors.email && <p className='text-xs text-destructive'>{fieldErrors.email}</p>}
                </div>
                <div className='space-y-1.5'>
                  <Label>Teléfono</Label>
                  <Input
                    value={fields.telefono}
                    onChange={(e) => setFields((f) => ({ ...f, telefono: e.target.value }))}
                    placeholder='+56 9 1234 5678'
                  />
                </div>
                <div className='flex items-center gap-2 pt-4'>
                  <Switch
                    id='activo-switch'
                    checked={fields.activo}
                    onCheckedChange={(v) => setFields((f) => ({ ...f, activo: v }))}
                  />
                  <Label htmlFor='activo-switch'>Activa</Label>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab 2: Direcciones ── */}
        <TabsContent value='direcciones' className='mt-4'>
          <Card>
            <CardHeader className='flex flex-row items-center justify-between py-3'>
              <CardTitle className='text-base'>Direcciones</CardTitle>
              <Button
                size='sm'
                variant='outline'
                onClick={() => setDirDialog({ open: true })}
              >
                <Icons.add className='h-4 w-4 mr-1.5' />
                Agregar
              </Button>
            </CardHeader>
            <CardContent className='p-0'>
              {fieldErrors.direccionesPorDefecto && (
                <p className='text-xs text-destructive px-4 pb-2'>{fieldErrors.direccionesPorDefecto}</p>
              )}
              {direccionesToShow.length === 0 ? (
                <div className='flex flex-col items-center justify-center py-12 text-muted-foreground text-sm'>
                  <Icons.info className='h-8 w-8 mb-2 opacity-40' />
                  No hay direcciones agregadas
                </div>
              ) : (
                <table className='w-full text-sm'>
                  <thead>
                    <tr className='border-b bg-muted/40'>
                      <th className='px-4 py-2 text-left font-medium'>Código</th>
                      <th className='px-4 py-2 text-left font-medium'>Descripción</th>
                      <th className='px-4 py-2 text-left font-medium'>Dirección</th>
                      <th className='px-4 py-2 text-left font-medium'>País / Comuna</th>
                      <th className='px-4 py-2 text-center font-medium'>Principal</th>
                      <th className='px-4 py-2 w-20' />
                    </tr>
                  </thead>
                  <tbody>
                    {direccionesToShow.map((dir) => (
                      <tr key={dir.id} className='border-b hover:bg-muted/30 transition-colors'>
                        <td className='px-4 py-2 font-mono text-xs'>{dir.codigo}</td>
                        <td className='px-4 py-2'>{dir.descripcion}</td>
                        <td className='px-4 py-2'>{dir.direccion}</td>
                        <td className='px-4 py-2 text-xs text-muted-foreground'>
                          {dir.pais.descripcion}
                          {dir.comuna && <><br />{dir.comuna.descripcion}</>}
                        </td>
                        <td className='px-4 py-2 text-center'>
                          {dir.esPorDefecto && (
                            <Badge variant='default' className='text-xs'>Principal</Badge>
                          )}
                        </td>
                        <td className='px-4 py-2'>
                          <div className='flex gap-1'>
                            <Button
                              variant='ghost'
                              size='icon'
                              className='h-7 w-7'
                              onClick={() => {
                                const localDir = isEdit ? undefined : localDirecciones.find((d) => d._localId === dir.id)
                                setDirDialog({
                                  open: true,
                                  initial: {
                                    id: isEdit ? dir.id : undefined,
                                    codigo: dir.codigo,
                                    descripcion: dir.descripcion,
                                    paisId: dir.paisId,
                                    comunaId: dir.comunaId ?? undefined,
                                    direccion: dir.direccion,
                                    esPorDefecto: dir.esPorDefecto,
                                  },
                                  localId: localDir?._localId,
                                })
                              }}
                            >
                              <Icons.edit className='h-3.5 w-3.5' />
                            </Button>
                            <Button
                              variant='ghost'
                              size='icon'
                              className='h-7 w-7 text-destructive hover:text-destructive'
                              onClick={() => {
                                const localDir = isEdit ? undefined : localDirecciones.find((d) => d._localId === dir.id)
                                setDeleteDir({
                                  open: true,
                                  id: isEdit ? dir.id : undefined,
                                  localId: localDir?._localId,
                                })
                              }}
                            >
                              <Icons.trash className='h-3.5 w-3.5' />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab 3: Contactos ── */}
        <TabsContent value='contactos' className='mt-4'>
          <Card>
            <CardHeader className='flex flex-row items-center justify-between py-3'>
              <CardTitle className='text-base'>Contactos</CardTitle>
              <Button
                size='sm'
                variant='outline'
                onClick={() => setConDialog({ open: true })}
              >
                <Icons.add className='h-4 w-4 mr-1.5' />
                Agregar
              </Button>
            </CardHeader>
            <CardContent className='p-0'>
              {contactosToShow.length === 0 ? (
                <div className='flex flex-col items-center justify-center py-12 text-muted-foreground text-sm'>
                  <Icons.user className='h-8 w-8 mb-2 opacity-40' />
                  No hay contactos agregados
                </div>
              ) : (
                <table className='w-full text-sm'>
                  <thead>
                    <tr className='border-b bg-muted/40'>
                      <th className='px-4 py-2 text-left font-medium'>Nombre</th>
                      <th className='px-4 py-2 text-left font-medium'>Tipo</th>
                      <th className='px-4 py-2 text-left font-medium'>Teléfono / Email</th>
                      <th className='px-4 py-2 text-center font-medium'>Rep. Legal</th>
                      <th className='px-4 py-2 w-20' />
                    </tr>
                  </thead>
                  <tbody>
                    {contactosToShow.map((con) => (
                      <tr key={con.id} className='border-b hover:bg-muted/30 transition-colors'>
                        <td className='px-4 py-2 font-medium'>{con.nombre}</td>
                        <td className='px-4 py-2 text-muted-foreground'>{con.tipo ?? '—'}</td>
                        <td className='px-4 py-2 text-xs text-muted-foreground'>
                          {con.telefono && <div>{con.telefono}</div>}
                          {con.email && <div>{con.email}</div>}
                          {!con.telefono && !con.email && '—'}
                        </td>
                        <td className='px-4 py-2 text-center'>
                          {con.esRepresentanteLegal && (
                            <Badge variant='secondary' className='text-xs'>Sí</Badge>
                          )}
                        </td>
                        <td className='px-4 py-2'>
                          <div className='flex gap-1'>
                            <Button
                              variant='ghost'
                              size='icon'
                              className='h-7 w-7'
                              onClick={() => {
                                const localCon = isEdit ? undefined : localContactos.find((c) => c._localId === con.id)
                                setConDialog({
                                  open: true,
                                  initial: {
                                    id: isEdit ? con.id : undefined,
                                    codigo: con.codigo,
                                    nombre: con.nombre,
                                    rut: con.rut ?? '',
                                    whatsapp: con.whatsapp ?? '',
                                    email: con.email ?? '',
                                    telefono: con.telefono ?? '',
                                    tipo: con.tipo ?? '',
                                    esRepresentanteLegal: con.esRepresentanteLegal,
                                  },
                                  localId: localCon?._localId,
                                })
                              }}
                            >
                              <Icons.edit className='h-3.5 w-3.5' />
                            </Button>
                            <Button
                              variant='ghost'
                              size='icon'
                              className='h-7 w-7 text-destructive hover:text-destructive'
                              onClick={() => {
                                const localCon = isEdit ? undefined : localContactos.find((c) => c._localId === con.id)
                                setDeleteCon({
                                  open: true,
                                  id: isEdit ? con.id : undefined,
                                  localId: localCon?._localId,
                                })
                              }}
                            >
                              <Icons.trash className='h-3.5 w-3.5' />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab 4: Logo (solo edición) ── */}
        {isEdit && (
          <TabsContent value='logo' className='mt-4'>
            <Card>
              <CardHeader>
                <CardTitle className='text-base'>Logo</CardTitle>
                <CardDescription>
                  Aparece en el encabezado de los documentos PDF que emite esta empresa.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <LogoUploadField empresaId={empresaId!} logo={empresa?.logo ?? null} />
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* ── Tab 5: SMTP (solo edición) ── */}
        {isEdit && (
          <TabsContent value='smtp' className='mt-4'>
            {esEmpresaActiva ? (
              <SmtpConfigForm />
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className='text-base'>Configuración SMTP</CardTitle>
                  <CardDescription>
                    La configuración de correo se guarda para la empresa activa en la cabecera.
                    Cambia el selector de empresa a <strong>{empresa?.razonSocial}</strong> para
                    ver o editar su configuración SMTP.
                  </CardDescription>
                </CardHeader>
              </Card>
            )}
          </TabsContent>
        )}
      </Tabs>

      {/* ── Footer ── */}
      <Separator />
      <div className='flex items-center gap-3 justify-end'>
        <Button variant='outline' onClick={() => router.push('/dashboard/configuracion/empresas')}>
          Cancelar
        </Button>
        <Button onClick={handleSubmit} isLoading={isPending}>
          <Icons.check className='mr-2 h-4 w-4' />
          {isEdit ? 'Guardar cambios' : 'Crear empresa'}
        </Button>
      </div>

      {/* ── Dialogs ── */}
      <DireccionDialog
        open={dirDialog.open}
        initial={dirDialog.initial}
        paisOrigen={paisOrigen}
        paises={paises}
        comunas={comunas}
        onClose={() => setDirDialog({ open: false })}
        onSave={handleSaveDireccion}
        isSaving={savingDir}
      />
      <ContactoDialog
        open={conDialog.open}
        initial={conDialog.initial}
        onClose={() => setConDialog({ open: false })}
        onSave={handleSaveContacto}
        isSaving={savingCon}
      />
      <AlertModal
        isOpen={deleteDir.open}
        onClose={() => setDeleteDir({ open: false })}
        onConfirm={handleDeleteDireccion}
        loading={deletingDir}
      />
      <AlertModal
        isOpen={deleteCon.open}
        onClose={() => setDeleteCon({ open: false })}
        onConfirm={handleDeleteContacto}
        loading={deletingCon}
      />
    </div>
  )
}
