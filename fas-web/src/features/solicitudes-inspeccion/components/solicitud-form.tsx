'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Icons } from '@/components/icons'
import { entidadesService } from '@/features/entidades/service'
import { usuariosService } from '@/features/usuarios/service'
import { articulosService } from '@/features/materiales/articulos/service'
import { createMantenedorService } from '@/features/mantenedor-simple/service'
import { useTemporada } from '@/contexts/temporada-context'
import { usePuedeEscribir } from '@/hooks/use-item-acceso'
import { MotivoQuickCreate } from '@/features/motivos-inspeccion/components/motivo-quick-create'
import { solicitudDetailOptions, solicitudesKeys } from '../queries'
import { solicitudesService } from '../service'
import { FUNCION_LABELS } from '../types'
import type { AsignadoInput, FuncionAsignado, SolicitudCreateInput } from '../types'
import { SelectMultiple } from './select-multiple'

const motivosService = createMantenedorService('motivos-inspeccion')
const especiesService = createMantenedorService('especies')
const variedadesService = createMantenedorService('variedades')
const calibresService = createMantenedorService('calibres')
const categoriasService = createMantenedorService('categorias')
const mercadosService = createMantenedorService('mercados')
const paisesService = createMantenedorService('paises')
const calificacionesService = createMantenedorService('calificaciones')

const MAX_ADJUNTO_BYTES = 10 * 1024 * 1024
const ACCEPT_ADJUNTOS = '.pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp,.heic'
const ITEM = 'CAL_SOLICITUDES'

function formatoBytes(b: number): string {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`
  return `${(b / (1024 * 1024)).toFixed(1)} MB`
}

function toLocalInput(iso: string): string {
  const d = new Date(iso)
  const off = d.getTimezoneOffset()
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16)
}

interface SolicitudFormProps {
  solicitudId?: number
}

export function SolicitudForm({ solicitudId }: SolicitudFormProps) {
  const isEdit = !!solicitudId
  const router = useRouter()
  const queryClient = useQueryClient()
  const { temporada } = useTemporada()
  const puedeEscribir = usePuedeEscribir(ITEM)
  const inputAdjuntoRef = useRef<HTMLInputElement>(null)

  const [productorId, setProductorId] = useState<number | null>(null)
  const [direccionId, setDireccionId] = useState<number | null>(null)
  const [contactoId, setContactoId] = useState<number | null>(null)
  const [motivoId, setMotivoId] = useState<number | null>(null)
  const [fechaHora, setFechaHora] = useState('')
  const [mercadoId, setMercadoId] = useState<number | null>(null)
  const [paisIds, setPaisIds] = useState<number[]>([])
  const [clienteId, setClienteId] = useState<number | null>(null)
  const [fechaDespacho, setFechaDespacho] = useState('')
  const [especieId, setEspecieId] = useState<number | null>(null)
  const [articuloIds, setArticuloIds] = useState<number[]>([])
  const [variedadIds, setVariedadIds] = useState<number[]>([])
  const [calibreIds, setCalibreIds] = useState<number[]>([])
  const [categoriaIds, setCategoriaIds] = useState<number[]>([])
  const [calificacionId, setCalificacionId] = useState<number | null>(null)
  const [cantidadPallets, setCantidadPallets] = useState('')
  const [asignados, setAsignados] = useState<AsignadoInput[]>([])
  const [observaciones, setObservaciones] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const { data: solicitud, isLoading } = useQuery({
    ...solicitudDetailOptions(solicitudId ?? 0),
    enabled: isEdit,
  })

  // ── Catálogos ──
  const { data: productores } = useQuery({
    queryKey: ['productores-options'],
    queryFn: () => entidadesService.list({ tipo: 'PRODUCTOR', limit: 500, activo: true }),
    staleTime: 60_000,
  })
  const { data: usuarios } = useQuery({
    queryKey: ['usuarios-options'],
    queryFn: () => usuariosService.list({ limit: 500 }),
    staleTime: 60_000,
  })
  const { data: motivos } = useQuery({
    queryKey: ['motivos-options'],
    queryFn: () => motivosService.list({ soloActivos: true, limit: 500 }),
    staleTime: 60_000,
  })
  const { data: especies } = useQuery({
    queryKey: ['especies-options'],
    queryFn: () => especiesService.list({ soloActivos: true, limit: 500 }),
    staleTime: 60_000,
  })
  const { data: mercados } = useQuery({
    queryKey: ['mercados-options-solicitud'],
    queryFn: () => mercadosService.list({ soloActivos: true, limit: 500 }),
    staleTime: 5 * 60_000,
  })
  const { data: paises } = useQuery({
    queryKey: ['paises-options-solicitud'],
    queryFn: () => paisesService.list({ soloActivos: true, limit: 500 }),
    staleTime: 5 * 60_000,
  })
  const { data: clientes } = useQuery({
    queryKey: ['clientes-extranjeros-options'],
    queryFn: () => entidadesService.list({ tipo: 'CLIENTE_EXTRANJERO', limit: 500, activo: true }),
    staleTime: 60_000,
  })
  const { data: articulosEmbalaje } = useQuery({
    queryKey: ['articulos-embalaje-options-solicitud'],
    queryFn: () => articulosService.list({ tipo: 'EMBALAJE', activo: true, limit: 500 }),
    staleTime: 60_000,
  })
  const { data: calificaciones } = useQuery({
    queryKey: ['calificaciones-options'],
    queryFn: () => calificacionesService.list({ soloActivos: true, limit: 500 }),
    staleTime: 5 * 60_000,
  })
  const { data: variedadesData } = useQuery({
    queryKey: ['variedades-options-solicitud', especieId],
    queryFn: () => variedadesService.list({ limit: 500, especieId: especieId! }),
    staleTime: 60_000,
    enabled: !!especieId,
  })
  const { data: calibresData } = useQuery({
    queryKey: ['calibres-options-solicitud', especieId],
    queryFn: () => calibresService.list({ limit: 500, especieId: especieId! }),
    staleTime: 60_000,
    enabled: !!especieId,
  })
  const { data: categoriasData } = useQuery({
    queryKey: ['categorias-options-solicitud', especieId],
    queryFn: () => categoriasService.list({ limit: 500, especieId: especieId! }),
    staleTime: 60_000,
    enabled: !!especieId,
  })

  // Direcciones/contactos del productor seleccionado
  const { data: productorDetalle } = useQuery({
    queryKey: ['entidad-detalle', productorId],
    queryFn: () => entidadesService.getById(productorId!),
    enabled: !!productorId,
    staleTime: 30_000,
  })
  const direcciones = productorDetalle?.direcciones ?? []
  const direccionSel = direcciones.find((d) => d.id === direccionId)
  const contactos = productorDetalle?.contactos ?? []

  useEffect(() => {
    if (solicitud) {
      const d = solicitud.data
      setProductorId(d.entidadProductorId)
      setDireccionId(d.direccionId)
      setContactoId(d.contactoId)
      setMotivoId(d.motivoId)
      setFechaHora(toLocalInput(d.fechaHora))
      setMercadoId(d.mercadoId)
      setPaisIds(d.paises.map((p) => p.pais.id))
      setClienteId(d.clienteId)
      setFechaDespacho(d.fechaDespacho?.slice(0, 10) ?? '')
      setEspecieId(d.especieId)
      setArticuloIds(d.embalajes.map((e) => e.articulo.id))
      setVariedadIds(d.variedades.map((v) => v.variedad.id))
      setCalibreIds(d.calibres.map((c) => c.calibre.id))
      setCategoriaIds(d.categorias.map((c) => c.categoria.id))
      setCalificacionId(d.calificacionId)
      setCantidadPallets(d.cantidadPallets != null ? String(d.cantidadPallets) : '')
      setAsignados(d.asignados.map((a) => ({ usuarioId: a.usuarioId, funcion: a.funcion })))
      setObservaciones(d.observaciones ?? '')
    }
  }, [solicitud])

  const usuariosDisponibles = useMemo(() => {
    const asignadosIds = new Set(asignados.map((a) => a.usuarioId))
    return (usuarios?.data ?? []).filter((u) => !asignadosIds.has(u.id))
  }, [usuarios, asignados])

  function agregarAsignado(usuarioId: string) {
    setAsignados((prev) => [...prev, { usuarioId, funcion: 'ACUDIR' }])
  }
  function cambiarFuncion(usuarioId: string, funcion: FuncionAsignado) {
    setAsignados((prev) => prev.map((a) => (a.usuarioId === usuarioId ? { ...a, funcion } : a)))
  }
  function quitarAsignado(usuarioId: string) {
    setAsignados((prev) => prev.filter((a) => a.usuarioId !== usuarioId))
  }
  function nombreUsuario(id: string) {
    return usuarios?.data.find((u) => u.id === id)?.nombre ?? id
  }

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!isEdit && !temporada) e.temporada = 'Selecciona una temporada activa en la barra superior'
    if (!productorId) e.productor = 'El productor es requerido'
    if (!direccionId) e.direccion = 'La dirección es requerida'
    if (!motivoId) e.motivo = 'El motivo es requerido'
    if (!fechaHora) e.fechaHora = 'La fecha y hora son requeridas'
    if (asignados.length === 0) e.asignados = 'Debe asignar al menos un usuario'
    else if (!asignados.some((a) => a.funcion === 'ACUDIR')) e.asignados = 'Al menos un asignado debe tener función Acudir'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function buildPayload(): SolicitudCreateInput {
    return {
      temporadaId: temporada?.id ?? 0,
      entidadProductorId: productorId!,
      direccionId: direccionId!,
      contactoId,
      motivoId: motivoId!,
      fechaHora: new Date(fechaHora).toISOString(),
      mercadoId,
      paisIds,
      clienteId,
      fechaDespacho: fechaDespacho || null,
      especieId,
      articuloIds,
      variedadIds,
      calibreIds,
      categoriaIds,
      calificacionId,
      cantidadPallets: cantidadPallets ? Number(cantidadPallets) : null,
      observaciones: observaciones.trim() || null,
      asignados,
    }
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = buildPayload()
      if (isEdit) return solicitudesService.update(solicitudId!, payload)
      return solicitudesService.create(payload)
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: solicitudesKeys.all })
      toast.success(isEdit ? 'Solicitud actualizada' : `Solicitud creada — ${res.data.codigo}`)
      if (isEdit && solicitud?.data.estado === 'NOTIFICADA') {
        toast.info('Se notificó automáticamente a los asignados por el cambio')
      }
      if (!isEdit) router.push(`/dashboard/calidad/solicitudes/${res.data.id}`)
    },
    onError: (e: Error) => toast.error(e.message || 'Error al guardar la solicitud'),
  })

  const subirAdjuntoMutation = useMutation({
    mutationFn: (archivo: File) => solicitudesService.subirAdjunto(solicitudId!, archivo, 'CREACION'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: solicitudesKeys.detail(solicitudId!) })
      queryClient.invalidateQueries({ queryKey: solicitudesKeys.all })
    },
    onError: (e: Error) => toast.error(e.message || 'Error al subir el adjunto'),
  })
  const eliminarAdjuntoMutation = useMutation({
    mutationFn: (adjuntoId: number) => solicitudesService.eliminarAdjunto(solicitudId!, adjuntoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: solicitudesKeys.detail(solicitudId!) })
      queryClient.invalidateQueries({ queryKey: solicitudesKeys.all })
    },
    onError: (e: Error) => toast.error(e.message || 'Error al eliminar el adjunto'),
  })

  function agregarArchivos(files: FileList | null) {
    if (!files) return
    for (const f of Array.from(files)) {
      if (f.size > MAX_ADJUNTO_BYTES) {
        toast.error(`"${f.name}" supera los 10 MB`)
        continue
      }
      subirAdjuntoMutation.mutate(f)
    }
    if (inputAdjuntoRef.current) inputAdjuntoRef.current.value = ''
  }

  function handleSubmit() {
    if (!validate()) {
      toast.error('Hay campos por corregir')
      return
    }
    mutation.mutate()
  }

  if (isEdit && isLoading) {
    return <p className='text-sm text-muted-foreground'>Cargando…</p>
  }

  const adjuntosExistentes = solicitud?.data.adjuntos.filter((a) => a.etapa === 'CREACION') ?? []
  const puedeGestionarAdjuntos = isEdit && solicitud?.data.estado === 'NOTIFICADA'
  const estaCerrada = solicitud?.data.estado === 'CERRADA'
  const soloLectura = !puedeEscribir || estaCerrada
  const isPending = mutation.isPending

  return (
    <div className='space-y-6'>
      {soloLectura && (
        <Badge variant='secondary'>
          {estaCerrada ? 'Cerrada — no editable' : 'Solo lectura — sin permiso de edición'}
        </Badge>
      )}
      <fieldset disabled={soloLectura} className='m-0 space-y-6 border-0 p-0'>
      <Card>
        <CardHeader>
          <CardTitle>{isEdit ? `Solicitud ${solicitud?.data.codigo}` : 'Nueva Solicitud de Inspección'}</CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          {!isEdit && errors.temporada && <p className='text-xs text-destructive'>{errors.temporada}</p>}

          {/* Fila 1: Productor, Dirección */}
          <div className='grid gap-4 sm:grid-cols-2'>
            <div className='space-y-1.5'>
              <Label>Productor <span className='text-destructive'>*</span></Label>
              <Select
                value={productorId ? String(productorId) : ''}
                onValueChange={(v) => { setProductorId(Number(v)); setDireccionId(null); setContactoId(null) }}
              >
                <SelectTrigger><SelectValue placeholder='Seleccionar productor...' /></SelectTrigger>
                <SelectContent>
                  {(productores?.data ?? []).map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.descripcion}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.productor && <p className='text-xs text-destructive'>{errors.productor}</p>}
            </div>
            <div className='space-y-1.5'>
              <Label>Dirección <span className='text-destructive'>*</span></Label>
              <Select value={direccionId ? String(direccionId) : ''} onValueChange={(v) => setDireccionId(Number(v))} disabled={!productorId}>
                <SelectTrigger>
                  <SelectValue placeholder={productorId ? 'Seleccionar dirección...' : 'Selecciona un productor primero'} />
                </SelectTrigger>
                <SelectContent>
                  {direcciones.map((d) => (
                    <SelectItem key={d.id} value={String(d.id)}>
                      {d.direccion}{d.comuna ? ` — ${d.comuna.descripcion}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {direccionSel && direccionSel.latitud != null && direccionSel.longitud != null && (
                <a
                  href={`https://www.google.com/maps?q=${direccionSel.latitud},${direccionSel.longitud}`}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='inline-flex items-center gap-1 text-xs text-primary hover:underline'
                >
                  <Icons.mapPin className='h-3 w-3' /> Ver ubicación en mapa
                </a>
              )}
              {errors.direccion && <p className='text-xs text-destructive'>{errors.direccion}</p>}
            </div>
          </div>

          {/* Fila 2: Contacto, Motivo, Fecha y hora de visita */}
          <div className='grid gap-4 sm:grid-cols-3'>
            <div className='space-y-1.5'>
              <Label>Contacto</Label>
              <Select value={contactoId ? String(contactoId) : 'none'} onValueChange={(v) => setContactoId(v === 'none' ? null : Number(v))} disabled={!productorId}>
                <SelectTrigger><SelectValue placeholder='Sin contacto...' /></SelectTrigger>
                <SelectContent>
                  <SelectItem value='none'>Sin contacto</SelectItem>
                  {contactos.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className='space-y-1.5'>
              <Label>Motivo <span className='text-destructive'>*</span></Label>
              <div className='flex items-end gap-2'>
                <div className='flex-1'>
                  <Select value={motivoId ? String(motivoId) : ''} onValueChange={(v) => setMotivoId(Number(v))}>
                    <SelectTrigger><SelectValue placeholder='Seleccionar...' /></SelectTrigger>
                    <SelectContent>
                      {(motivos?.data ?? []).map((m) => (
                        <SelectItem key={m.id} value={String(m.id)}>{m.descripcion}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <MotivoQuickCreate onCreated={(m) => setMotivoId(m.id)} />
              </div>
              {errors.motivo && <p className='text-xs text-destructive'>{errors.motivo}</p>}
            </div>
            <div className='space-y-1.5'>
              <Label>Fecha y hora de visita <span className='text-destructive'>*</span></Label>
              <Input type='datetime-local' value={fechaHora} onChange={(e) => setFechaHora(e.target.value)} />
              {errors.fechaHora && <p className='text-xs text-destructive'>{errors.fechaHora}</p>}
            </div>
          </div>

          {/* Fila 3: Mercado, Países, Cliente, Fecha de despacho */}
          <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
            <div className='space-y-1.5'>
              <Label>Mercado</Label>
              <Select value={mercadoId ? String(mercadoId) : 'none'} onValueChange={(v) => setMercadoId(v === 'none' ? null : Number(v))}>
                <SelectTrigger><SelectValue placeholder='Sin definir' /></SelectTrigger>
                <SelectContent>
                  <SelectItem value='none'>Sin definir</SelectItem>
                  {(mercados?.data ?? []).map((m) => (
                    <SelectItem key={m.id} value={String(m.id)}>{m.descripcion}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className='space-y-1.5'>
              <Label>Países</Label>
              <SelectMultiple
                options={(paises?.data ?? []).map((p) => ({ id: p.id, label: p.descripcion }))}
                selectedIds={paisIds}
                onChange={setPaisIds}
                placeholder='Agregar país...'
              />
            </div>
            <div className='space-y-1.5'>
              <Label>Cliente <span className='text-muted-foreground text-xs'>(opcional)</span></Label>
              <Select value={clienteId ? String(clienteId) : 'none'} onValueChange={(v) => setClienteId(v === 'none' ? null : Number(v))}>
                <SelectTrigger><SelectValue placeholder='Sin definir' /></SelectTrigger>
                <SelectContent>
                  <SelectItem value='none'>Sin definir</SelectItem>
                  {(clientes?.data ?? []).map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.descripcion}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className='space-y-1.5'>
              <Label>Fecha de despacho <span className='text-muted-foreground text-xs'>(opcional)</span></Label>
              <Input type='date' value={fechaDespacho} onChange={(e) => setFechaDespacho(e.target.value)} />
            </div>
          </div>

          {/* Fila 4: Especie, Embalaje, Variedades, Calibres */}
          <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
            <div className='space-y-1.5'>
              <Label>Especie</Label>
              <Select
                value={especieId ? String(especieId) : 'none'}
                onValueChange={(v) => {
                  const nuevo = v === 'none' ? null : Number(v)
                  setEspecieId(nuevo)
                  setVariedadIds([]); setCalibreIds([]); setCategoriaIds([])
                }}
              >
                <SelectTrigger><SelectValue placeholder='Sin especie...' /></SelectTrigger>
                <SelectContent>
                  <SelectItem value='none'>Sin especie</SelectItem>
                  {(especies?.data ?? []).map((e) => (
                    <SelectItem key={e.id} value={String(e.id)}>{e.descripcion}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className='space-y-1.5'>
              <Label>Embalaje</Label>
              <SelectMultiple
                options={(articulosEmbalaje?.data ?? []).map((a) => ({ id: a.id, label: `${a.codigo} — ${a.descripcion}` }))}
                selectedIds={articuloIds}
                onChange={setArticuloIds}
                placeholder='Agregar embalaje...'
              />
            </div>
            <div className='space-y-1.5'>
              <Label>Variedades</Label>
              <SelectMultiple
                options={(variedadesData?.data ?? []).map((v) => ({ id: v.id, label: v.descripcion }))}
                selectedIds={variedadIds}
                onChange={setVariedadIds}
                placeholder={especieId ? 'Agregar variedad...' : 'Selecciona una especie primero'}
                disabled={!especieId}
              />
            </div>
            <div className='space-y-1.5'>
              <Label>Calibres</Label>
              <SelectMultiple
                options={(calibresData?.data ?? []).map((c) => ({ id: c.id, label: c.descripcion }))}
                selectedIds={calibreIds}
                onChange={setCalibreIds}
                placeholder={especieId ? 'Agregar calibre...' : 'Selecciona una especie primero'}
                disabled={!especieId}
              />
            </div>
          </div>

          {/* Fila 5: Categorías, Calificación, Cantidad de pallet */}
          <div className='grid gap-4 sm:grid-cols-3'>
            <div className='space-y-1.5'>
              <Label>Categorías</Label>
              <SelectMultiple
                options={(categoriasData?.data ?? []).map((c) => ({ id: c.id, label: c.descripcion }))}
                selectedIds={categoriaIds}
                onChange={setCategoriaIds}
                placeholder={especieId ? 'Agregar categoría...' : 'Selecciona una especie primero'}
                disabled={!especieId}
              />
            </div>
            <div className='space-y-1.5'>
              <Label>Calificación</Label>
              <Select value={calificacionId ? String(calificacionId) : 'none'} onValueChange={(v) => setCalificacionId(v === 'none' ? null : Number(v))}>
                <SelectTrigger><SelectValue placeholder='Sin definir' /></SelectTrigger>
                <SelectContent>
                  <SelectItem value='none'>Sin definir</SelectItem>
                  {(calificaciones?.data ?? []).map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.descripcion}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className='space-y-1.5'>
              <Label>Cantidad de pallets</Label>
              <Input type='number' value={cantidadPallets} onChange={(e) => setCantidadPallets(e.target.value)} />
            </div>
          </div>

          {/* Fila 6: Personas asignadas */}
          <div className='space-y-2'>
            <Label>Personas asignadas <span className='text-destructive'>*</span></Label>
            <Select value='' onValueChange={agregarAsignado} disabled={usuariosDisponibles.length === 0}>
              <SelectTrigger><SelectValue placeholder='Agregar persona...' /></SelectTrigger>
              <SelectContent>
                {usuariosDisponibles.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.nombre} — {u.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {asignados.length > 0 && (
              <div className='space-y-2 rounded-md border p-2'>
                {asignados.map((a) => (
                  <div key={a.usuarioId} className='flex items-center gap-2'>
                    <span className='flex-1 text-sm'>{nombreUsuario(a.usuarioId)}</span>
                    <Select value={a.funcion} onValueChange={(v) => cambiarFuncion(a.usuarioId, v as FuncionAsignado)}>
                      <SelectTrigger className='h-8 w-[130px]'><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(FUNCION_LABELS) as FuncionAsignado[]).map((f) => (
                          <SelectItem key={f} value={f}>{FUNCION_LABELS[f]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button type='button' variant='ghost' size='icon' className='h-8 w-8' onClick={() => quitarAsignado(a.usuarioId)}>
                      <Icons.trash className='h-4 w-4' />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <p className='text-xs text-muted-foreground'>
              <Badge variant='outline' className='mr-1'>Acudir</Badge> asiste a la inspección ·
              <Badge variant='outline' className='mx-1'>Notificar</Badge> solo recibe aviso
            </p>
            {errors.asignados && <p className='text-xs text-destructive'>{errors.asignados}</p>}
          </div>

          {puedeGestionarAdjuntos && (
            <div className='space-y-2'>
              <Label>Adjuntos <span className='text-muted-foreground text-xs'>(opcional)</span></Label>
              <input
                ref={inputAdjuntoRef}
                type='file'
                multiple
                accept={ACCEPT_ADJUNTOS}
                className='hidden'
                onChange={(e) => agregarArchivos(e.target.files)}
              />
              <Button type='button' variant='outline' size='sm' onClick={() => inputAdjuntoRef.current?.click()}>
                <Icons.upload className='mr-1 h-4 w-4' /> Agregar archivos
              </Button>
              <p className='text-xs text-muted-foreground'>PDF, Word, Excel o imágenes. Máx. 10 MB por archivo.</p>
              {adjuntosExistentes.length > 0 && (
                <div className='space-y-1 rounded-md border p-2'>
                  {adjuntosExistentes.map((a) => (
                    <div key={a.id} className='flex items-center gap-2 text-sm'>
                      <Icons.paperclip className='h-4 w-4 shrink-0 text-muted-foreground' />
                      <span className='flex-1 truncate'>{a.nombre}</span>
                      <span className='text-xs text-muted-foreground'>{formatoBytes(a.tamano)}</span>
                      <Button
                        type='button'
                        variant='ghost'
                        size='icon'
                        className='h-7 w-7'
                        onClick={() => eliminarAdjuntoMutation.mutate(a.id)}
                        disabled={eliminarAdjuntoMutation.isPending}
                      >
                        <Icons.close className='h-4 w-4' />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Fila 7: Observaciones */}
          <div className='space-y-1.5'>
            <Label>Observaciones</Label>
            <Textarea
              rows={4}
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder='Indicaciones para el inspector, referencias del lugar, etc.'
            />
          </div>
        </CardContent>
      </Card>
      </fieldset>

      <div className='flex justify-end gap-2'>
        <Button type='button' variant='outline' onClick={() => router.push('/dashboard/calidad/solicitudes')} disabled={isPending}>
          {soloLectura ? 'Volver' : 'Cancelar'}
        </Button>
        {!soloLectura && (
          <Button type='button' onClick={handleSubmit} isLoading={isPending}>
            <Icons.check className='mr-1 h-4 w-4' /> {isEdit ? 'Guardar cambios' : 'Crear solicitud'}
          </Button>
        )}
      </div>
    </div>
  )
}
