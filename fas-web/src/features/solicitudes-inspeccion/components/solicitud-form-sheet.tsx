'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
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
import { Badge } from '@/components/ui/badge'
import { Icons } from '@/components/icons'
import { entidadesService } from '@/features/entidades/service'
import { usuariosService } from '@/features/usuarios/service'
import { createMantenedorService } from '@/features/mantenedor-simple/service'
import { useTemporada } from '@/contexts/temporada-context'
import { MotivoQuickCreate } from '@/features/motivos-inspeccion/components/motivo-quick-create'
import { solicitudesService } from '../service'
import { solicitudesKeys } from '../queries'
import { FUNCION_LABELS } from '../types'
import type { SolicitudInspeccion, AsignadoInput, FuncionAsignado } from '../types'

interface SolicitudFormSheetProps {
  item?: SolicitudInspeccion
  open: boolean
  onOpenChange: (open: boolean) => void
}

const motivosService = createMantenedorService('motivos-inspeccion')
const especiesService = createMantenedorService('especies')

const MAX_ADJUNTO_BYTES = 10 * 1024 * 1024
const ACCEPT_ADJUNTOS = '.pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp,.heic'

function formatoBytes(b: number): string {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`
  return `${(b / (1024 * 1024)).toFixed(1)} MB`
}

function toLocalInput(iso: string): string {
  // Convierte ISO a valor para <input type="datetime-local"> en hora local del navegador
  const d = new Date(iso)
  const off = d.getTimezoneOffset()
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16)
}

export function SolicitudFormSheet({ item, open, onOpenChange }: SolicitudFormSheetProps) {
  const isEdit = !!item
  const queryClient = useQueryClient()
  const { temporada } = useTemporada()

  const [productorId, setProductorId] = useState<number | null>(null)
  const [direccionId, setDireccionId] = useState<number | null>(null)
  const [contactoId, setContactoId] = useState<number | null>(null)
  const [especieId, setEspecieId] = useState<number | null>(null)
  const [motivoId, setMotivoId] = useState<number | null>(null)
  const [fechaHora, setFechaHora] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [asignados, setAsignados] = useState<AsignadoInput[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const inputAdjuntoRef = useRef<HTMLInputElement>(null)

  // ── Catálogos ──
  const { data: productores } = useQuery({
    queryKey: ['productores-options'],
    queryFn: () => entidadesService.list({ tipo: 'PRODUCTOR', limit: 500, activo: true }),
    staleTime: 60_000,
    enabled: open,
  })
  const { data: usuarios } = useQuery({
    queryKey: ['usuarios-options'],
    queryFn: () => usuariosService.list({ limit: 500 }),
    staleTime: 60_000,
    enabled: open,
  })
  const { data: motivos } = useQuery({
    queryKey: ['motivos-options'],
    queryFn: () => motivosService.list({ soloActivos: true, limit: 500 }),
    staleTime: 60_000,
    enabled: open,
  })
  const { data: especies } = useQuery({
    queryKey: ['especies-options'],
    queryFn: () => especiesService.list({ soloActivos: true, limit: 500 }),
    staleTime: 60_000,
    enabled: open,
  })
  // Direcciones del productor seleccionado
  const { data: productorDetalle } = useQuery({
    queryKey: ['entidad-detalle', productorId],
    queryFn: () => entidadesService.getById(productorId!),
    enabled: open && !!productorId,
    staleTime: 30_000,
  })
  const direcciones = productorDetalle?.direcciones ?? []
  const direccionSel = direcciones.find((d) => d.id === direccionId)
  const contactos = productorDetalle?.contactos ?? []

  // ── Inicialización al abrir ──
  useEffect(() => {
    if (!open) return
    setErrors({})
    if (item) {
      setProductorId(item.entidadProductorId)
      setDireccionId(item.direccionId)
      setContactoId(item.contactoId)
      setEspecieId(item.especieId)
      setMotivoId(item.motivoId)
      setFechaHora(toLocalInput(item.fechaHora))
      setObservaciones(item.observaciones ?? '')
      setAsignados(item.asignados.map((a) => ({ usuarioId: a.usuarioId, funcion: a.funcion })))
    } else {
      setProductorId(null)
      setDireccionId(null)
      setContactoId(null)
      setEspecieId(null)
      setMotivoId(null)
      setFechaHora('')
      setObservaciones('')
      setAsignados([])
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item?.id])

  const usuariosDisponibles = useMemo(() => {
    const asignadosIds = new Set(asignados.map((a) => a.usuarioId))
    return (usuarios?.data ?? []).filter((u) => !asignadosIds.has(u.id))
  }, [usuarios, asignados])

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        entidadProductorId: productorId!,
        direccionId: direccionId!,
        contactoId: contactoId,
        especieId: especieId,
        motivoId: motivoId!,
        fechaHora: new Date(fechaHora).toISOString(),
        observaciones: observaciones.trim() || null,
        asignados,
      }
      if (isEdit) {
        return solicitudesService.update(item!.id, payload)
      }
      return solicitudesService.create({ ...payload, temporadaId: temporada!.id })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: solicitudesKeys.all })
      toast.success(isEdit ? 'Solicitud actualizada' : 'Solicitud creada')
      if (isEdit && item?.estado === 'NOTIFICADA') {
        toast.info('Se notificó automáticamente a los asignados por el cambio')
      }
      onOpenChange(false)
    },
    onError: (e: Error) => toast.error(e.message || 'Error al guardar la solicitud'),
  })

  // Edición: la solicitud ya existe, los adjuntos se suben/eliminan de inmediato
  const subirAdjuntoMutation = useMutation({
    mutationFn: (archivo: File) => solicitudesService.subirAdjunto(item!.id, archivo, 'CREACION'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: solicitudesKeys.detail(item!.id) })
      queryClient.invalidateQueries({ queryKey: solicitudesKeys.all })
    },
    onError: (e: Error) => toast.error(e.message || 'Error al subir el adjunto'),
  })
  const eliminarAdjuntoMutation = useMutation({
    mutationFn: (adjuntoId: number) => solicitudesService.eliminarAdjunto(item!.id, adjuntoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: solicitudesKeys.detail(item!.id) })
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

  const adjuntosExistentes = item?.adjuntos.filter((a) => a.etapa === 'CREACION') ?? []
  // Los adjuntos solo tienen sentido una vez notificada la visita (antes no aplica,
  // y una vez cerrada la solicitud queda congelada).
  const puedeGestionarAdjuntos = isEdit && item?.estado === 'NOTIFICADA'

  function validar(): boolean {
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

  function handleSubmit() {
    if (!validar()) return
    mutation.mutate()
  }

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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='flex w-full flex-col sm:max-w-xl'>
        <SheetHeader>
          <SheetTitle>{isEdit ? `Editar solicitud ${item?.codigo}` : 'Nueva solicitud de inspección'}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? 'Modifica los datos de la solicitud. Si ya fue notificada, se avisará a los asignados.'
              : `Se numerará según la temporada activa${temporada ? ` (${temporada.codigo})` : ''}.`}
          </SheetDescription>
        </SheetHeader>

        <div className='flex-1 space-y-4 overflow-auto px-1 py-2'>
          {!isEdit && errors.temporada && (
            <p className='text-sm text-destructive'>{errors.temporada}</p>
          )}

          {/* Productor */}
          <div className='space-y-1.5'>
            <Label>Productor <span className='text-destructive'>*</span></Label>
            <Select
              value={productorId ? String(productorId) : ''}
              onValueChange={(v) => { setProductorId(parseInt(v)); setDireccionId(null); setContactoId(null) }}
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

          {/* Dirección (dependiente) */}
          <div className='space-y-1.5'>
            <Label>Dirección / Lugar <span className='text-destructive'>*</span></Label>
            <Select
              value={direccionId ? String(direccionId) : ''}
              onValueChange={(v) => setDireccionId(parseInt(v))}
              disabled={!productorId}
            >
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
            {productorId && direcciones.length === 0 && (
              <p className='text-xs text-muted-foreground'>Este productor no tiene direcciones registradas.</p>
            )}
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

          {/* Contacto (dependiente, opcional) */}
          <div className='space-y-1.5'>
            <Label>Contacto en terreno <span className='text-muted-foreground text-xs'>(opcional)</span></Label>
            <Select
              value={contactoId ? String(contactoId) : 'none'}
              onValueChange={(v) => setContactoId(v === 'none' ? null : parseInt(v))}
              disabled={!productorId}
            >
              <SelectTrigger>
                <SelectValue placeholder={productorId ? 'Sin contacto...' : 'Selecciona un productor primero'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='none'>Sin contacto</SelectItem>
                {contactos.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.nombre}{c.tipo ? ` — ${c.tipo}` : ''}{c.telefono || c.whatsapp ? ` · ${c.telefono ?? c.whatsapp}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {productorId && contactos.length === 0 && (
              <p className='text-xs text-muted-foreground'>Este productor no tiene contactos registrados.</p>
            )}
          </div>

          {/* Motivo + quick create */}
          <div className='space-y-1.5'>
            <Label>Motivo de la visita <span className='text-destructive'>*</span></Label>
            <div className='flex items-end gap-2'>
              <div className='flex-1'>
                <Select value={motivoId ? String(motivoId) : ''} onValueChange={(v) => setMotivoId(parseInt(v))}>
                  <SelectTrigger><SelectValue placeholder='Seleccionar motivo...' /></SelectTrigger>
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

          {/* Especie opcional */}
          <div className='space-y-1.5'>
            <Label>Especie <span className='text-muted-foreground text-xs'>(opcional)</span></Label>
            <Select
              value={especieId ? String(especieId) : 'none'}
              onValueChange={(v) => setEspecieId(v === 'none' ? null : parseInt(v))}
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

          {/* Fecha y hora */}
          <div className='space-y-1.5'>
            <Label>Fecha y hora de la visita <span className='text-destructive'>*</span></Label>
            <Input
              type='datetime-local'
              value={fechaHora}
              onChange={(e) => setFechaHora(e.target.value)}
            />
            {errors.fechaHora && <p className='text-xs text-destructive'>{errors.fechaHora}</p>}
          </div>

          {/* Asignados */}
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

          {/* Adjuntos: solo tienen sentido una vez notificada la visita */}
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

          {/* Observaciones */}
          <div className='space-y-1.5'>
            <Label>Observaciones</Label>
            <Textarea
              rows={4}
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder='Indicaciones para el inspector, referencias del lugar, etc.'
            />
          </div>
        </div>

        <SheetFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)} disabled={mutation.isPending}>Cancelar</Button>
          <Button onClick={handleSubmit} isLoading={mutation.isPending}>
            {isEdit ? 'Guardar cambios' : 'Crear solicitud'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
