'use client'

import { useState, useRef, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { MultiCombobox } from '@/components/shared/multi-combobox'
import { Icons } from '@/components/icons'
import { createMantenedorService } from '@/features/mantenedor-simple/service'
import { solicitudesService } from '../service'
import { solicitudesKeys } from '../queries'
import { RESULTADO_CIERRE_LABELS } from '../types'
import type {
  SolicitudInspeccion,
  SolicitudLinea,
  ResultadoCierre,
  EstadoLineaInspeccion,
  SolicitudDefectoInput,
  TipoMedidaDefecto,
  SolicitudMadurezInput,
  TipoDatoMadurez,
} from '../types'
import { articuloDescripcionComercial } from '@/lib/articulo'

const gruposDefectoService = createMantenedorService('grupos-defecto')
const defectosService = createMantenedorService('defectos')
const caracteristicasMadurezService = createMantenedorService('caracteristicas-madurez')

interface CaracteristicaMadurezOption {
  id: number
  codigo: string
  descripcion: string
  tipoDato: TipoDatoMadurez
  unidad?: { id: number; codigo: string; descripcion: string } | null
  especies?: { especieId: number }[]
}

interface DefectoOption {
  id: number
  descripcion: string
  grupoDefecto?: { id: number } | null
  tipoMedida: TipoMedidaDefecto
  especies?: { especieId: number }[]
}

interface GrupoOption {
  id: number
  descripcion: string
}

const MAX_BYTES = 10 * 1024 * 1024
const ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp,.heic'

// Estado de cierre de una línea (en edición local).
interface LineaCierreState {
  veredicto: EstadoLineaInspeccion | ''
  defectos: SolicitudDefectoInput[]
  caracteristicas: SolicitudMadurezInput[]
}

function formatoBytes(b: number): string {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`
  return `${(b / (1024 * 1024)).toFixed(1)} MB`
}

// ISO → valor para <input datetime-local> en hora local.
function toLocalInput(iso: string): string {
  const d = new Date(iso)
  const off = d.getTimezoneOffset()
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16)
}

// ─── Editor de cierre de UNA línea (veredicto + defectos + madurez) ──────────
interface LineaCierreEditorProps {
  // linea undefined = cierre LEGACY de cabecera (solicitud sin líneas): sin filtro
  // por especie y veredicto a nivel solicitud.
  linea?: SolicitudLinea
  valor: LineaCierreState
  onChange: (next: LineaCierreState) => void
  grupos: GrupoOption[]
  defectosCatalogo: DefectoOption[]
  caracteristicasCatalogo: CaracteristicaMadurezOption[]
}

function LineaCierreEditor({ linea, valor, onChange, grupos, defectosCatalogo, caracteristicasCatalogo }: LineaCierreEditorProps) {
  const [grupoSel, setGrupoSel] = useState('')
  const [defectoSel, setDefectoSel] = useState('')
  const [valorSel, setValorSel] = useState('')
  const [caracSel, setCaracSel] = useState('')
  const [caracValor, setCaracValor] = useState('')

  const especieId = linea ? linea.especie.id : null

  const defectosDelGrupo = grupoSel
    ? defectosCatalogo.filter((d) => {
        if (d.grupoDefecto?.id !== Number(grupoSel)) return false
        if (especieId == null) return true
        const especies = d.especies ?? []
        return especies.length === 0 || especies.some((e) => e.especieId === especieId)
      })
    : []
  const defectoElegido = defectoSel ? defectosCatalogo.find((d) => d.id === Number(defectoSel)) : undefined

  const caracteristicasDisponibles = caracteristicasCatalogo.filter((c) => {
    if (valor.caracteristicas.some((x) => x.caracteristicaId === c.id)) return false
    if (especieId == null) return true
    const especies = c.especies ?? []
    return especies.length === 0 || especies.some((e) => e.especieId === especieId)
  })
  const caracElegida = caracSel ? caracteristicasCatalogo.find((c) => c.id === Number(caracSel)) : undefined

  function agregarDefecto() {
    if (!grupoSel || !defectoSel || !defectoElegido) { toast.error('Selecciona grupo y defecto'); return }
    const v = Number(valorSel.replace(',', '.'))
    if (!Number.isFinite(v) || v < 0) { toast.error('Ingresa un valor válido'); return }
    if (defectoElegido.tipoMedida === 'PORCENTAJE') {
      if (v > 100) { toast.error('El porcentaje no puede superar 100'); return }
    } else if (!Number.isInteger(v)) { toast.error('El valor por unidades debe ser un número entero'); return }
    if (valor.defectos.some((d) => d.grupoDefectoId === Number(grupoSel) && d.defectoId === Number(defectoSel))) {
      toast.error('Ese defecto ya está agregado en esta línea'); return
    }
    onChange({ ...valor, defectos: [...valor.defectos, { grupoDefectoId: Number(grupoSel), defectoId: Number(defectoSel), valor: v }] })
    setDefectoSel('')
    setValorSel('')
  }

  function etiquetaDefecto(d: SolicitudDefectoInput): string {
    const def = defectosCatalogo.find((x) => x.id === d.defectoId)
    const grupo = grupos.find((g) => g.id === d.grupoDefectoId)
    const sufijo = def?.tipoMedida === 'PORCENTAJE' ? '%' : ' u.'
    return `${grupo?.descripcion ?? d.grupoDefectoId} · ${def?.descripcion ?? d.defectoId}: ${String(d.valor).replace('.', ',')}${sufijo}`
  }

  function agregarCaracteristica() {
    if (!caracSel || !caracElegida) { toast.error('Selecciona un indicador de madurez'); return }
    if (valor.caracteristicas.some((c) => c.caracteristicaId === Number(caracSel))) { toast.error('Ese indicador ya está agregado'); return }
    if (caracElegida.tipoDato === 'TEXTO') {
      const texto = caracValor.trim()
      if (!texto) { toast.error('Ingresa un valor'); return }
      onChange({ ...valor, caracteristicas: [...valor.caracteristicas, { caracteristicaId: Number(caracSel), valorTexto: texto }] })
    } else {
      const v = Number(caracValor.replace(',', '.'))
      if (!Number.isFinite(v) || v < 0) { toast.error('Ingresa un valor válido'); return }
      if (caracElegida.tipoDato === 'ENTERO' && !Number.isInteger(v)) { toast.error('El valor debe ser un número entero'); return }
      if (caracElegida.tipoDato === 'PORCENTAJE' && v > 100) { toast.error('El porcentaje no puede superar 100'); return }
      onChange({ ...valor, caracteristicas: [...valor.caracteristicas, { caracteristicaId: Number(caracSel), valorNumerico: v }] })
    }
    setCaracSel('')
    setCaracValor('')
  }

  function etiquetaCaracteristica(c: SolicitudMadurezInput): string {
    const def = caracteristicasCatalogo.find((x) => x.id === c.caracteristicaId)
    if (c.valorTexto != null) return `${def?.descripcion ?? c.caracteristicaId}: ${c.valorTexto}`
    const sufijo = def?.tipoDato === 'PORCENTAJE' ? '%' : def?.unidad ? ` ${def.unidad.codigo}` : ''
    return `${def?.descripcion ?? c.caracteristicaId}: ${String(c.valorNumerico ?? '').replace('.', ',')}${sufijo}`
  }

  return (
    <div className='space-y-3 rounded-md border p-3'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <div className='text-sm font-medium'>
          {linea
            ? <>{linea.especie.descripcion} · {linea.variedad.descripcion}<span className='text-muted-foreground'> · {articuloDescripcionComercial(linea.articulo)}</span></>
            : 'Resultado general (solicitud sin líneas)'}
        </div>
        {linea && <div className='w-56 space-y-1'>
          <Label className='text-xs'>Veredicto <span className='text-destructive'>*</span></Label>
          <Select value={valor.veredicto} onValueChange={(v) => onChange({ ...valor, veredicto: v as EstadoLineaInspeccion })}>
            <SelectTrigger><SelectValue placeholder='Selecciona...' /></SelectTrigger>
            <SelectContent>
              {(Object.keys(RESULTADO_CIERRE_LABELS) as ResultadoCierre[]).map((r) => (
                <SelectItem key={r} value={r}>{RESULTADO_CIERRE_LABELS[r]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>}
      </div>

      {/* Defectos de la línea */}
      <div className='space-y-2'>
        <Label className='text-xs'>Defectos</Label>
        {valor.defectos.length > 0 && (
          <div className='flex flex-wrap gap-1.5'>
            {valor.defectos.map((d, i) => (
              <Badge key={i} variant='secondary' className='gap-1 pr-1'>
                {etiquetaDefecto(d)}
                <button type='button' onClick={() => onChange({ ...valor, defectos: valor.defectos.filter((_, j) => j !== i) })} className='ml-0.5 rounded-sm hover:bg-muted-foreground/20'>
                  <Icons.close className='h-3 w-3' />
                </button>
              </Badge>
            ))}
          </div>
        )}
        <div className='grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end'>
          <Select value={grupoSel} onValueChange={(v) => { setGrupoSel(v); setDefectoSel(''); setValorSel('') }}>
            <SelectTrigger><SelectValue placeholder='Grupo...' /></SelectTrigger>
            <SelectContent>{grupos.map((g) => <SelectItem key={g.id} value={String(g.id)}>{g.descripcion}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={defectoSel} onValueChange={setDefectoSel} disabled={!grupoSel}>
            <SelectTrigger><SelectValue placeholder='Defecto...' /></SelectTrigger>
            <SelectContent>{defectosDelGrupo.map((d) => <SelectItem key={d.id} value={String(d.id)}>{d.descripcion}</SelectItem>)}</SelectContent>
          </Select>
          <Input
            className='w-24'
            value={valorSel}
            onChange={(e) => setValorSel(e.target.value)}
            placeholder={defectoElegido?.tipoMedida === 'PORCENTAJE' ? '12,5 %' : '3 u.'}
            disabled={!defectoSel}
          />
          <Button type='button' variant='secondary' size='sm' onClick={agregarDefecto} disabled={!defectoSel || !valorSel}>
            <Icons.add className='mr-1 h-4 w-4' /> Agregar
          </Button>
        </div>
      </div>

      {/* Indicadores de madurez de la línea */}
      <div className='space-y-2'>
        <Label className='text-xs'>Indicadores de madurez</Label>
        {valor.caracteristicas.length > 0 && (
          <div className='flex flex-wrap gap-1.5'>
            {valor.caracteristicas.map((c, i) => (
              <Badge key={i} variant='secondary' className='gap-1 pr-1'>
                {etiquetaCaracteristica(c)}
                <button type='button' onClick={() => onChange({ ...valor, caracteristicas: valor.caracteristicas.filter((_, j) => j !== i) })} className='ml-0.5 rounded-sm hover:bg-muted-foreground/20'>
                  <Icons.close className='h-3 w-3' />
                </button>
              </Badge>
            ))}
          </div>
        )}
        <div className='grid gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-end'>
          <Select value={caracSel} onValueChange={(v) => { setCaracSel(v); setCaracValor('') }}>
            <SelectTrigger><SelectValue placeholder='Indicador...' /></SelectTrigger>
            <SelectContent>{caracteristicasDisponibles.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.descripcion}</SelectItem>)}</SelectContent>
          </Select>
          <Input
            className='w-28'
            value={caracValor}
            onChange={(e) => setCaracValor(e.target.value)}
            placeholder={caracElegida?.tipoDato === 'TEXTO' ? 'Texto...' : caracElegida?.tipoDato === 'ENTERO' ? '3' : '12,5'}
            disabled={!caracSel}
          />
          <Button type='button' variant='secondary' size='sm' onClick={agregarCaracteristica} disabled={!caracSel || !caracValor}>
            <Icons.add className='mr-1 h-4 w-4' /> Agregar
          </Button>
        </div>
      </div>
    </div>
  )
}

interface SolicitudCerrarDialogProps {
  solicitud: SolicitudInspeccion
  open: boolean
  onOpenChange: (open: boolean) => void
}

// Valor especial de "Quién asiste" para el Servicio Tercero (2026-11-10).
const SERVICIO_TERCERO = '__SERVICIO_TERCERO__'

// "Editar inspección" (2026-11-10): registra la visita (fecha, quién asiste,
// comentarios, veredictos, defectos, indicadores de madurez y adjuntos) y la
// GUARDA sin cerrar. "Cerrar inspección" (acción del listado) luego solo cambia
// el estado. No se cierra al pinchar fuera ni con Esc, para no perder datos.
export function SolicitudCerrarDialog({ solicitud, open, onOpenChange }: SolicitudCerrarDialogProps) {
  const queryClient = useQueryClient()
  const [comentarios, setComentarios] = useState('')
  const [fechaHora, setFechaHora] = useState('')
  const [acudeIds, setAcudeIds] = useState<string[]>([])
  const [servicioTercero, setServicioTercero] = useState('')
  // Estado de cierre por línea, indexado por id de línea.
  const [lineasCierre, setLineasCierre] = useState<Record<number, LineaCierreState>>({})
  // Estado de cierre de CABECERA (legacy, solicitud sin líneas).
  const [legacyCierre, setLegacyCierre] = useState<LineaCierreState>({ veredicto: '', defectos: [], caracteristicas: [] })
  const sinLineas = solicitud.lineas.length === 0
  const [pendientes, setPendientes] = useState<File[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  // Notificados: lista fija (no editable aquí; el backend la conserva).
  const notificados = solicitud.asignados.filter((a) => a.funcion === 'NOTIFICAR')
  const notificadosIds = new Set(notificados.map((a) => a.usuarioId))

  // Prefill al abrir con lo ya guardado en la solicitud.
  useEffect(() => {
    if (!open) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hidratación al abrir
    setFechaHora(solicitud.fechaHora ? toLocalInput(solicitud.fechaHora) : '')
    setComentarios(solicitud.comentariosCierre ?? '')
    setServicioTercero(solicitud.servicioTercero ?? '')
    const acude = solicitud.asignados.filter((a) => a.funcion === 'ACUDIR').map((a) => a.usuarioId)
    setAcudeIds(solicitud.servicioTercero ? [...acude, SERVICIO_TERCERO] : acude)
    setPendientes([])
    const porLinea: Record<number, LineaCierreState> = {}
    for (const l of solicitud.lineas) {
      porLinea[l.id] = {
        veredicto: l.estadoCierre ?? '',
        defectos: solicitud.defectos
          .filter((d) => d.solicitudLineaId === l.id)
          .map((d) => ({ grupoDefectoId: d.grupoDefecto.id, defectoId: d.defecto.id, valor: Number(d.valor) })),
        caracteristicas: (solicitud.madurez ?? [])
          .filter((m) => m.solicitudLineaId === l.id)
          .map((m) => ({ caracteristicaId: m.caracteristicaId, valorNumerico: m.valorNumerico != null ? Number(m.valorNumerico) : null, valorTexto: m.valorTexto ?? null })),
      }
    }
    setLineasCierre(porLinea)
    // Legacy (sin líneas): defectos/madurez a nivel solicitud (línea null).
    setLegacyCierre({
      veredicto: '',
      defectos: solicitud.defectos
        .filter((d) => d.solicitudLineaId == null)
        .map((d) => ({ grupoDefectoId: d.grupoDefecto.id, defectoId: d.defecto.id, valor: Number(d.valor) })),
      caracteristicas: (solicitud.madurez ?? [])
        .filter((m) => m.solicitudLineaId == null)
        .map((m) => ({ caracteristicaId: m.caracteristicaId, valorNumerico: m.valorNumerico != null ? Number(m.valorNumerico) : null, valorTexto: m.valorTexto ?? null })),
    })
  }, [open, solicitud])

  const { data: inspectores } = useQuery({ queryKey: ['inspectores-calidad'], queryFn: () => solicitudesService.inspectores(), staleTime: 5 * 60_000, enabled: open })
  const { data: gruposData } = useQuery({ queryKey: ['grupos-defecto-options'], queryFn: () => gruposDefectoService.list({ soloActivos: true, limit: 500 }), staleTime: 5 * 60_000, enabled: open })
  const { data: defectosData } = useQuery({ queryKey: ['defectos-options'], queryFn: () => defectosService.list({ soloActivos: true, limit: 500 }), staleTime: 5 * 60_000, enabled: open })
  const { data: caracteristicasData } = useQuery({ queryKey: ['caracteristicas-madurez-options'], queryFn: () => caracteristicasMadurezService.list({ soloActivos: true, limit: 500 }), staleTime: 5 * 60_000, enabled: open })

  const grupos = (gruposData?.data ?? []) as unknown as GrupoOption[]
  const defectosCatalogo = (defectosData?.data ?? []) as unknown as DefectoOption[]
  const caracteristicasCatalogo = (caracteristicasData?.data ?? []) as unknown as CaracteristicaMadurezOption[]

  // Opciones de "Quién asiste": usuarios Inspector Calidad + los asistentes ya
  // asignados (se conservan aunque no tengan el permiso) + Servicio Tercero.
  // Nunca los notificados (las listas no se mezclan).
  const opcionesAsiste = (() => {
    const mapa = new Map<string, string>()
    for (const a of solicitud.asignados) if (a.funcion === 'ACUDIR') mapa.set(a.usuarioId, a.usuario.nombre)
    for (const u of inspectores?.data ?? []) if (!mapa.has(u.id)) mapa.set(u.id, u.nombre)
    const usuarios = [...mapa.entries()]
      .filter(([id]) => !notificadosIds.has(id))
      .map(([value, label]) => ({ value, label }))
    return [...usuarios, { value: SERVICIO_TERCERO, label: 'Servicio Tercero' }]
  })()
  const conServicioTercero = acudeIds.includes(SERVICIO_TERCERO)

  const guardarMutation = useMutation({
    mutationFn: async () => {
      for (const archivo of pendientes) {
        await solicitudesService.subirAdjunto(solicitud.id, archivo, 'CIERRE')
      }
      const base = {
        comentarios: comentarios.trim() || null,
        fechaHora: fechaHora ? new Date(fechaHora).toISOString() : null,
        acudeIds: acudeIds.filter((id) => id !== SERVICIO_TERCERO),
        servicioTercero: conServicioTercero ? servicioTercero.trim() : null,
      }
      if (sinLineas) {
        return solicitudesService.guardarCierre(solicitud.id, {
          ...base,
          defectos: legacyCierre.defectos,
          caracteristicas: legacyCierre.caracteristicas,
        })
      }
      const lineas = solicitud.lineas.map((l) => {
        const estado = lineasCierre[l.id] ?? { veredicto: '', defectos: [], caracteristicas: [] }
        return {
          solicitudLineaId: l.id,
          veredicto: (estado.veredicto || null) as EstadoLineaInspeccion | null,
          defectos: estado.defectos,
          caracteristicas: estado.caracteristicas,
        }
      })
      return solicitudesService.guardarCierre(solicitud.id, { ...base, lineas })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: solicitudesKeys.all })
      toast.success('Inspección guardada. Para cerrarla usa "Cerrar inspección" en el listado.')
      setPendientes([])
      onOpenChange(false)
    },
    onError: (e: Error) => {
      // Los adjuntos ya subidos no se reintentan.
      queryClient.invalidateQueries({ queryKey: solicitudesKeys.all })
      toast.error(e.message || 'Error al guardar la inspección')
    },
  })

  function agregarArchivos(files: FileList | null) {
    if (!files) return
    const validos: File[] = []
    for (const f of Array.from(files)) {
      if (f.size > MAX_BYTES) { toast.error(`"${f.name}" supera los 10 MB`); continue }
      validos.push(f)
    }
    setPendientes((prev) => [...prev, ...validos])
    if (inputRef.current) inputRef.current.value = ''
  }

  function handleGuardar() {
    if (conServicioTercero && !servicioTercero.trim()) {
      toast.error('Indica el nombre del Servicio Tercero')
      return
    }
    guardarMutation.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className='max-h-[92vh] sm:max-w-[900px] overflow-auto'
        // No se cierra al pinchar fuera ni con Esc: se perderían los datos.
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Editar inspección {solicitud.codigo}</DialogTitle>
          <DialogDescription>
            Registra la fecha de la visita, quién asistió, y el veredicto con los defectos e indicadores de madurez
            de cada línea. Al guardar la solicitud sigue abierta; ciérrala luego con &quot;Cerrar inspección&quot;
            en el listado.
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4 py-2'>
          <div className='grid gap-4 sm:grid-cols-2'>
            <div className='space-y-1.5'>
              <Label>Fecha y hora de visita <span className='text-destructive'>*</span></Label>
              <Input type='datetime-local' value={fechaHora} onChange={(e) => setFechaHora(e.target.value)} />
            </div>
            <div className='space-y-1.5'>
              <Label>Quién asiste <span className='text-destructive'>*</span></Label>
              <MultiCombobox
                options={opcionesAsiste}
                selected={acudeIds}
                onChange={setAcudeIds}
                placeholder='Selecciona inspectores o Servicio Tercero...'
              />
              {conServicioTercero && (
                <Input
                  value={servicioTercero}
                  maxLength={200}
                  onChange={(e) => setServicioTercero(e.target.value)}
                  placeholder='Nombre del Servicio Tercero *'
                />
              )}
            </div>
          </div>

          <div className='space-y-1.5'>
            <Label>Notificados</Label>
            {notificados.length > 0 ? (
              <div className='flex flex-wrap gap-1.5'>
                {notificados.map((a) => (
                  <Badge key={a.usuarioId} variant='outline'>{a.usuario.nombre}</Badge>
                ))}
              </div>
            ) : (
              <p className='text-muted-foreground text-sm'>Sin notificados.</p>
            )}
          </div>

          <div className='space-y-1.5'>
            <Label>Comentarios <span className='text-destructive'>*</span></Label>
            <Textarea rows={3} value={comentarios} onChange={(e) => setComentarios(e.target.value)} placeholder='Hallazgos, observaciones...' />
          </div>

          {/* Veredicto + defectos + madurez POR LÍNEA (o de cabecera si legacy). */}
          <div className='space-y-2'>
            <Label>{sinLineas ? 'Resultado de la inspección' : 'Resultado por línea'} <span className='text-destructive'>*</span></Label>
            <div className='space-y-3'>
              {sinLineas ? (
                <LineaCierreEditor
                  valor={legacyCierre}
                  onChange={setLegacyCierre}
                  grupos={grupos}
                  defectosCatalogo={defectosCatalogo}
                  caracteristicasCatalogo={caracteristicasCatalogo}
                />
              ) : (
                solicitud.lineas.map((l) => (
                  <LineaCierreEditor
                    key={l.id}
                    linea={l}
                    valor={lineasCierre[l.id] ?? { veredicto: '', defectos: [], caracteristicas: [] }}
                    onChange={(next) => setLineasCierre((prev) => ({ ...prev, [l.id]: next }))}
                    grupos={grupos}
                    defectosCatalogo={defectosCatalogo}
                    caracteristicasCatalogo={caracteristicasCatalogo}
                  />
                ))
              )}
            </div>
          </div>

          <div className='space-y-2'>
            <Label>Archivos adjuntos</Label>
            <input ref={inputRef} type='file' multiple accept={ACCEPT} className='hidden' onChange={(e) => agregarArchivos(e.target.files)} />
            <Button type='button' variant='outline' size='sm' onClick={() => inputRef.current?.click()}>
              <Icons.upload className='mr-1 h-4 w-4' /> Agregar archivos
            </Button>
            <p className='text-xs text-muted-foreground'>PDF, Word, Excel o imágenes. Máx. 10 MB por archivo.</p>
            {pendientes.length > 0 && (
              <div className='space-y-1 rounded-md border p-2'>
                {pendientes.map((f, idx) => (
                  <div key={idx} className='flex items-center gap-2 text-sm'>
                    <Icons.paperclip className='h-4 w-4 shrink-0 text-muted-foreground' />
                    <span className='flex-1 truncate'>{f.name}</span>
                    <span className='text-xs text-muted-foreground'>{formatoBytes(f.size)}</span>
                    <Button type='button' variant='ghost' size='icon' className='h-7 w-7' onClick={() => setPendientes((prev) => prev.filter((_, i) => i !== idx))}>
                      <Icons.close className='h-4 w-4' />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)} disabled={guardarMutation.isPending}>Cancelar</Button>
          <Button onClick={handleGuardar} isLoading={guardarMutation.isPending}>
            <Icons.check className='mr-1 h-4 w-4' /> Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
