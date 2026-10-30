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
import { Combobox } from '@/components/ui/combobox'
import { entidadesService } from '@/features/entidades/service'
import { usuariosService } from '@/features/usuarios/service'
import { articulosService } from '@/features/materiales/articulos/service'
import { createMantenedorService } from '@/features/mantenedor-simple/service'
import { notasCalidadService } from '@/features/notas-calidad/service'
import { notasCondicionService } from '@/features/notas-condicion/service'
import { authClient } from '@/lib/auth-client'
import { useTemporada } from '@/contexts/temporada-context'
import { usePuedeEscribir } from '@/hooks/use-item-acceso'
import { solicitudDetailOptions, solicitudesKeys } from '../queries'
import { solicitudesService } from '../service'
import { FUNCION_LABELS, TIPO_INSPECCION_LABELS } from '../types'
import type { AsignadoInput, FuncionAsignado, SolicitudCreateInput, TipoInspeccion } from '../types'
import { SelectMultiple } from '@/components/shared/select-multiple'
import { CalidadesPermitidasInput, type CalidadPermitidaPar } from '@/components/shared/calidades-permitidas-input'

const especiesService = createMantenedorService('especies')
const variedadesService = createMantenedorService('variedades')
const calibresService = createMantenedorService('calibres')
const categoriasService = createMantenedorService('categorias')
const mercadosService = createMantenedorService('mercados')
const paisesService = createMantenedorService('paises')

const MAX_ADJUNTO_BYTES = 10 * 1024 * 1024
const ACCEPT_ADJUNTOS = '.pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp,.heic'
// Ingresar/editar solicitudes es exclusivo de Compras desde 2026-08-10 (ver
// Docs/Hallazgos/solicitud-inspeccion.md) — Calidad quedó restringida a
// ver+cerrar y ya no usa este formulario.
const ITEM = 'COMPRAS_SOLICITUDES'

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

// Línea de producto del formulario (2026-10-27): especie + embalaje + variedad
// (uno c/u) + categorías/calibres/calidades (varios) + cantidad de pallets.
interface LineaForm {
  especieId: number | null
  articuloId: number | null
  variedadId: number | null
  categoriaIds: number[]
  calibreIds: number[]
  calidadesPermitidas: CalidadPermitidaPar[]
  cantidadPallets: string
}
const LINEA_VACIA: LineaForm = {
  especieId: null, articuloId: null, variedadId: null,
  categoriaIds: [], calibreIds: [], calidadesPermitidas: [], cantidadPallets: '',
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
  const { data: session } = authClient.useSession()

  const [usuarioSolicitanteId, setUsuarioSolicitanteId] = useState<string | null>(null)
  const [productorId, setProductorId] = useState<number | null>(null)
  const [plantaId, setPlantaId] = useState<number | null>(null)
  const [direccionId, setDireccionId] = useState<number | null>(null)
  const [contactoId, setContactoId] = useState<number | null>(null)
  // Fecha de visita (2026-10-13): ya NO se ingresa al crear — vacía por defecto.
  // Se puede fijar al editar la visita, o en el cierre.
  const [fechaHora, setFechaHora] = useState('')
  const [mercadoId, setMercadoId] = useState<number | null>(null)
  const [paisIds, setPaisIds] = useState<number[]>([])
  const [clienteId, setClienteId] = useState<number | null>(null)
  const [fechaDespacho, setFechaDespacho] = useState('')
  // Tipo de inspección (solo informativo): '' = sin definir.
  const [tipoInspeccion, setTipoInspeccion] = useState<TipoInspeccion | ''>('')
  const [lineas, setLineas] = useState<LineaForm[]>([])
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
  const { data: plantasData } = useQuery({
    queryKey: ['plantas-options'],
    queryFn: () => entidadesService.list({ tipo: 'PLANTA', limit: 500, activo: true }),
    staleTime: 60_000,
  })
  const plantas = plantasData?.data ?? []
  const { data: usuarios } = useQuery({
    queryKey: ['usuarios-options'],
    queryFn: () => usuariosService.list({ limit: 500 }),
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
    queryKey: ['paises-options-solicitud', mercadoId],
    queryFn: () => paisesService.list({ soloActivos: true, limit: 500, mercadoId: mercadoId ?? undefined }),
    staleTime: 60_000,
    enabled: !!mercadoId,
  })
  const { data: clientes } = useQuery({
    queryKey: ['clientes-extranjeros-options'],
    queryFn: () => entidadesService.list({ tipo: 'CLIENTE_EXTRANJERO', limit: 500, activo: true }),
    staleTime: 60_000,
  })
  const { data: notasCalidad } = useQuery({
    queryKey: ['notas-calidad'],
    queryFn: () => notasCalidadService.list(),
    staleTime: 5 * 60_000,
  })
  const { data: notasCondicion } = useQuery({
    queryKey: ['notas-condicion'],
    queryFn: () => notasCondicionService.list(),
    staleTime: 5 * 60_000,
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

  // Al crear, el solicitante se precarga con el usuario de la sesión actual
  // (editable — alguien puede crear la solicitud en nombre de otro usuario).
  useEffect(() => {
    if (!isEdit && !usuarioSolicitanteId && session?.user?.id) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUsuarioSolicitanteId(session.user.id)
    }
  }, [isEdit, usuarioSolicitanteId, session])

  useEffect(() => {
    if (solicitud) {
      const d = solicitud.data
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hidratación del form al cargar la solicitud
      setUsuarioSolicitanteId(d.usuarioSolicitanteId)
      setProductorId(d.entidadProductorId)
      setPlantaId(d.plantaId ?? null)
      setDireccionId(d.direccionId)
      setContactoId(d.contactoId)
      setFechaHora(d.fechaHora ? toLocalInput(d.fechaHora) : '')
      setMercadoId(d.mercadoId)
      setPaisIds(d.paises.map((p) => p.pais.id))
      setClienteId(d.clienteId)
      setFechaDespacho(d.fechaDespacho?.slice(0, 10) ?? '')
      setTipoInspeccion(d.tipoInspeccion ?? '')
      setLineas(d.lineas.map((l) => ({
        especieId: l.especie.id,
        articuloId: l.articulo.id,
        variedadId: l.variedad.id,
        categoriaIds: l.categorias.map((c) => c.categoria.id),
        calibreIds: l.calibres.map((c) => c.calibre.id),
        calidadesPermitidas: l.calidades.map((c) => ({ notaCalidadId: c.notaCalidad.id, notaCondicionId: c.notaCondicion.id })),
        cantidadPallets: l.cantidadPallets != null ? String(l.cantidadPallets) : '',
      })))
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

  // ── Líneas ──
  function agregarLinea() {
    setLineas((prev) => [...prev, { ...LINEA_VACIA }])
  }
  function actualizarLinea(index: number, cambios: Partial<LineaForm>) {
    setLineas((prev) => prev.map((l, i) => (i === index ? { ...l, ...cambios } : l)))
  }
  function quitarLinea(index: number) {
    setLineas((prev) => prev.filter((_, i) => i !== index))
  }

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!isEdit && !temporada) e.temporada = 'Selecciona una temporada activa en la barra superior'
    if (!usuarioSolicitanteId) e.usuarioSolicitanteId = 'El solicitante es requerido'
    if (!productorId) e.productor = 'El productor es requerido'
    if (!direccionId) e.direccion = 'La dirección es requerida'
    // La fecha de visita ya no es obligatoria (2026-10-13): se fija al editar la
    // visita o en el cierre.
    // 2026-10-05: ya no se exige un asignado con función Acudir — basta con al
    // menos un asignado (puede ser solo Notificar).
    if (asignados.length === 0) e.asignados = 'Debe asignar al menos un usuario'
    // Detalle de producto (2026-10-27): al menos una línea y cada línea con
    // especie, embalaje y variedad.
    if (lineas.length === 0) e.lineas = 'Debe agregar al menos una línea de producto'
    else if (lineas.some((l) => !l.especieId || !l.articuloId || !l.variedadId)) {
      e.lineas = 'Cada línea requiere especie, embalaje y variedad'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function buildPayload(): SolicitudCreateInput {
    return {
      temporadaId: temporada?.id ?? 0,
      usuarioSolicitanteId: usuarioSolicitanteId!,
      entidadProductorId: productorId!,
      plantaId,
      direccionId: direccionId!,
      contactoId,
      fechaHora: fechaHora ? new Date(fechaHora).toISOString() : null,
      mercadoId,
      paisIds,
      clienteId,
      fechaDespacho: fechaDespacho || null,
      tipoInspeccion: tipoInspeccion || null,
      lineas: lineas.map((l) => ({
        especieId: l.especieId!,
        articuloId: l.articuloId!,
        variedadId: l.variedadId!,
        categoriaIds: l.categoriaIds,
        calibreIds: l.calibreIds,
        calidadesPermitidas: l.calidadesPermitidas,
        cantidadPallets: l.cantidadPallets ? Number(l.cantidadPallets) : null,
      })),
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
      // 2026-10-05: al grabar (crear o editar) se cierra el formulario y se
      // vuelve al listado.
      router.push('/dashboard/compras/solicitudes')
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
  const estaCerrada = solicitud?.data.estado === 'APROBADA' || solicitud?.data.estado === 'RECHAZADA' || solicitud?.data.estado === 'OBJETADA'
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

          {/* Fila 0: Solicitante */}
          <div className='space-y-1.5'>
            <Label>Solicitante <span className='text-destructive'>*</span></Label>
            <Select value={usuarioSolicitanteId ?? ''} onValueChange={setUsuarioSolicitanteId}>
              <SelectTrigger className='sm:w-1/2'><SelectValue placeholder='Seleccionar solicitante...' /></SelectTrigger>
              <SelectContent>
                {(usuarios?.data ?? []).map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.usuarioSolicitanteId && <p className='text-xs text-destructive'>{errors.usuarioSolicitanteId}</p>}
          </div>

          {/* Fila 1: Productor, Dirección */}
          <div className='grid gap-4 sm:grid-cols-2'>
            <div className='space-y-1.5'>
              <Label>Productor <span className='text-destructive'>*</span></Label>
              <Combobox
                value={productorId ? String(productorId) : ''}
                onChange={(v) => {
                  const id = Number(v)
                  setProductorId(id)
                  setDireccionId(null)
                  setContactoId(null)
                  // Si el productor también es planta, autocompleta la planta (editable).
                  if (plantas.some((p) => p.id === id)) setPlantaId(id)
                }}
                placeholder='Seleccionar productor...'
                searchPlaceholder='Buscar productor...'
                options={(productores?.data ?? []).map((p) => ({ value: String(p.id), label: p.descripcion }))}
              />
              {errors.productor && <p className='text-xs text-destructive'>{errors.productor}</p>}
            </div>
            <div className='space-y-1.5'>
              <Label>Planta</Label>
              <Combobox
                value={plantaId ? String(plantaId) : ''}
                onChange={(v) => setPlantaId(v ? Number(v) : null)}
                placeholder='Seleccionar planta...'
                searchPlaceholder='Buscar planta...'
                options={plantas.map((p) => ({ value: String(p.id), label: p.descripcion }))}
              />
              <p className='text-muted-foreground text-xs'>Se autocompleta si el productor también es planta (editable).</p>
            </div>
            <div className='space-y-1.5'>
              <Label>Dirección <span className='text-destructive'>*</span></Label>
              <Select value={direccionId ? String(direccionId) : ''} onValueChange={(v) => setDireccionId(Number(v))} disabled={!productorId}>
                <SelectTrigger className='w-full'>
                  <SelectValue placeholder={productorId ? 'Seleccionar dirección...' : 'Selecciona un productor primero'} />
                </SelectTrigger>
                <SelectContent>
                  {direcciones.map((d) => (
                    <SelectItem key={d.id} value={String(d.id)}>
                      {d.descripcion} — {d.direccion}{d.comuna ? ` — ${d.comuna.descripcion}` : ''}
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

          {/* Fila 2: Contacto, Fecha y hora de visita */}
          <div className='grid gap-4 sm:grid-cols-2'>
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
              {/* La fecha de visita ya no se ingresa al crear (2026-10-13): solo
                  se puede fijar/editar en una solicitud existente, o en el cierre. */}
              <Label>Fecha y hora de visita {!isEdit && <span className='text-muted-foreground text-xs'>(se define luego)</span>}</Label>
              <Input type='datetime-local' value={fechaHora} onChange={(e) => setFechaHora(e.target.value)} disabled={!isEdit} />
              {isEdit && <p className='text-muted-foreground text-xs'>Opcional: podés dejarla en blanco y fijarla en el cierre. Al guardarla, se reprograma el recordatorio.</p>}
              {errors.fechaHora && <p className='text-xs text-destructive'>{errors.fechaHora}</p>}
            </div>
          </div>

          {/* Fila 3: Mercado, Países, Cliente, Fecha de despacho */}
          <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
            <div className='space-y-1.5'>
              <Label>Mercado</Label>
              <Select value={mercadoId ? String(mercadoId) : 'none'} onValueChange={(v) => { setMercadoId(v === 'none' ? null : Number(v)); setPaisIds([]) }}>
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
                placeholder={mercadoId ? 'Agregar país...' : 'Elige un mercado primero'}
                disabled={!mercadoId}
              />
            </div>
            <div className='space-y-1.5'>
              <Label>Cliente <span className='text-muted-foreground text-xs'>(opcional)</span></Label>
              <Combobox
                value={clienteId ? String(clienteId) : 'none'}
                onChange={(v) => setClienteId(v === 'none' ? null : Number(v))}
                placeholder='Sin definir'
                searchPlaceholder='Buscar cliente...'
                options={[{ value: 'none', label: 'Sin definir' }, ...(clientes?.data ?? []).map((c) => ({ value: String(c.id), label: c.descripcion }))]}
              />
            </div>
            <div className='space-y-1.5'>
              <Label>Fecha de despacho <span className='text-muted-foreground text-xs'>(opcional)</span></Label>
              <Input type='date' value={fechaDespacho} onChange={(e) => setFechaDespacho(e.target.value)} />
            </div>
            <div className='space-y-1.5'>
              <Label>Tipo de inspección <span className='text-muted-foreground text-xs'>(opcional)</span></Label>
              <Select value={tipoInspeccion || 'none'} onValueChange={(v) => setTipoInspeccion(v === 'none' ? '' : (v as TipoInspeccion))}>
                <SelectTrigger><SelectValue placeholder='Sin definir' /></SelectTrigger>
                <SelectContent>
                  <SelectItem value='none'>Sin definir</SelectItem>
                  {(Object.keys(TIPO_INSPECCION_LABELS) as TipoInspeccion[]).map((t) => (
                    <SelectItem key={t} value={t}>{TIPO_INSPECCION_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Detalle de producto por LÍNEA (2026-10-27): cada línea con su
              especie, embalaje, variedad, categorías, calibres, calidades y
              cantidad de pallets. La especie de la línea gobierna sus opciones. */}
          <div className='space-y-3'>
            <div className='flex items-center justify-between'>
              <Label>Detalle de producto <span className='text-destructive'>*</span></Label>
              <Button type='button' variant='secondary' size='sm' onClick={agregarLinea}>
                <Icons.add className='mr-1 h-4 w-4' /> Agregar línea
              </Button>
            </div>
            {lineas.length === 0 && (
              <p className='text-xs text-muted-foreground'>Agrega al menos una línea de producto.</p>
            )}
            {lineas.map((linea, i) => (
              <LineaEditor
                key={i}
                index={i}
                linea={linea}
                especies={(especies?.data ?? []).map((e) => ({ id: e.id, descripcion: e.descripcion }))}
                notasCalidad={notasCalidad?.data ?? []}
                notasCondicion={notasCondicion?.data ?? []}
                onChange={(cambios) => actualizarLinea(i, cambios)}
                onRemove={() => quitarLinea(i)}
              />
            ))}
            {errors.lineas && <p className='text-xs text-destructive'>{errors.lineas}</p>}
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
        <Button type='button' variant='outline' onClick={() => router.push('/dashboard/compras/solicitudes')} disabled={isPending}>
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

// ─── Editor de una línea de producto (2026-10-27) ────────────────────────────
// Cada línea trae su propia especie, que gobierna variedad/calibres/categorías/
// calidades. Es un componente aparte para que sus useQuery por especie puedan
// usar hooks (una instancia por línea).
interface NotaConEspecies {
  id: number
  descripcion: string
  bloqueado: boolean
  especies: { especieId: number }[]
}
interface LineaEditorProps {
  index: number
  linea: LineaForm
  especies: { id: number; descripcion: string }[]
  notasCalidad: NotaConEspecies[]
  notasCondicion: NotaConEspecies[]
  onChange: (cambios: Partial<LineaForm>) => void
  onRemove: () => void
}

function LineaEditor({ index, linea, especies, notasCalidad, notasCondicion, onChange, onRemove }: LineaEditorProps) {
  const especieId = linea.especieId
  // Embalajes filtrados por la especie de la línea (el backend incluye los
  // genéricos sin especie, mismo criterio que la Orden de Compra).
  const { data: embalajesData } = useQuery({
    queryKey: ['articulos-embalaje-options-solicitud', especieId],
    queryFn: () => articulosService.list({ tipo: 'EMBALAJE', activo: true, especieId: especieId!, limit: 500 }),
    staleTime: 60_000,
    enabled: !!especieId,
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

  // Notas restringidas por la especie de ESTA línea (si está definida).
  const notasCalidadValidas = useMemo(() => {
    const todas = notasCalidad.filter((n) => !n.bloqueado)
    if (especieId == null) return todas
    return todas.filter((n) => n.especies.some((e) => e.especieId === especieId))
  }, [notasCalidad, especieId])
  const notasCondicionValidas = useMemo(() => {
    const todas = notasCondicion.filter((n) => !n.bloqueado)
    if (especieId == null) return todas
    return todas.filter((n) => n.especies.some((e) => e.especieId === especieId))
  }, [notasCondicion, especieId])

  return (
    <div className='space-y-3 rounded-md border p-3'>
      <div className='flex items-center justify-between'>
        <span className='text-sm font-medium'>Línea {index + 1}</span>
        <Button type='button' variant='ghost' size='icon' className='h-8 w-8' onClick={onRemove}>
          <Icons.trash className='h-4 w-4' />
        </Button>
      </div>
      <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
        <div className='space-y-1.5'>
          <Label>Especie <span className='text-destructive'>*</span></Label>
          <Select
            value={especieId ? String(especieId) : ''}
            onValueChange={(v) => onChange({ especieId: Number(v), articuloId: null, variedadId: null, categoriaIds: [], calibreIds: [], calidadesPermitidas: [] })}
          >
            <SelectTrigger><SelectValue placeholder='Seleccionar...' /></SelectTrigger>
            <SelectContent>
              {especies.map((e) => <SelectItem key={e.id} value={String(e.id)}>{e.descripcion}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className='space-y-1.5'>
          <Label>Embalaje <span className='text-destructive'>*</span></Label>
          <Combobox
            value={linea.articuloId ? String(linea.articuloId) : ''}
            onChange={(v) => onChange({ articuloId: v ? Number(v) : null })}
            placeholder={especieId ? 'Seleccionar embalaje...' : 'Elige especie primero'}
            searchPlaceholder='Buscar embalaje...'
            disabled={!especieId}
            options={(embalajesData?.data ?? []).map((a) => ({ value: String(a.id), label: `${a.codigo} — ${a.descripcion}` }))}
          />
        </div>
        <div className='space-y-1.5'>
          <Label>Variedad <span className='text-destructive'>*</span></Label>
          <Select value={linea.variedadId ? String(linea.variedadId) : ''} onValueChange={(v) => onChange({ variedadId: Number(v) })} disabled={!especieId}>
            <SelectTrigger><SelectValue placeholder={especieId ? 'Seleccionar...' : 'Elige especie primero'} /></SelectTrigger>
            <SelectContent>
              {(variedadesData?.data ?? []).map((v) => <SelectItem key={v.id} value={String(v.id)}>{v.descripcion}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
        <div className='space-y-1.5'>
          <Label>Categorías</Label>
          <SelectMultiple
            options={(categoriasData?.data ?? []).map((c) => ({ id: c.id, label: c.descripcion }))}
            selectedIds={linea.categoriaIds}
            onChange={(ids) => onChange({ categoriaIds: ids })}
            placeholder={especieId ? 'Agregar categoría...' : 'Elige especie primero'}
            disabled={!especieId}
          />
        </div>
        <div className='space-y-1.5'>
          <Label>Calibres</Label>
          <SelectMultiple
            options={(calibresData?.data ?? []).map((c) => ({ id: c.id, label: c.descripcion }))}
            selectedIds={linea.calibreIds}
            onChange={(ids) => onChange({ calibreIds: ids })}
            placeholder={especieId ? 'Agregar calibre...' : 'Elige especie primero'}
            disabled={!especieId}
          />
        </div>
        <div className='space-y-1.5'>
          <Label>Cantidad de pallets</Label>
          <Input type='number' value={linea.cantidadPallets} onChange={(e) => onChange({ cantidadPallets: e.target.value })} />
        </div>
      </div>
      <CalidadesPermitidasInput
        value={linea.calidadesPermitidas}
        onChange={(v) => onChange({ calidadesPermitidas: v })}
        calidades={notasCalidadValidas.map((n) => ({ id: n.id, descripcion: n.descripcion }))}
        condiciones={notasCondicionValidas.map((n) => ({ id: n.id, descripcion: n.descripcion }))}
      />
    </div>
  )
}
