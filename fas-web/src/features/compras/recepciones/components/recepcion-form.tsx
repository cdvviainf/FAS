'use client'

import { useState, useEffect, useRef } from 'react'
import { useTemporada } from '@/contexts/temporada-context'
import { AvisoSinTemporada } from '@/components/shared/aviso-sin-temporada'
import { TemporadaSelect } from '@/components/shared/temporada-select'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { isHTTPError } from 'ky'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Icons } from '@/components/icons'
import { Badge } from '@/components/ui/badge'
import { Combobox } from '@/components/ui/combobox'
import { SelectMultiple } from '@/components/shared/select-multiple'
import { Modal } from '@/components/ui/modal'
import { usePuedeEscribir } from '@/hooks/use-item-acceso'
import { entidadesService } from '@/features/entidades/service'
import { entidadDetailOptions } from '@/features/entidades/queries'
import { ordenesCompraService } from '@/features/compras/ordenes-compra/service'
import { templatesCargaService } from '@/features/templates-carga/service'
import { instructivoEmbalajeService } from '@/features/compras/instructivo-embalaje/service'
import { semanaISO } from '@/lib/format'
import { recepcionDetailOptions, recepcionesKeys } from '../queries'
import { recepcionesService } from '../service'
import type { RecepcionCreateInput } from '../types'
import { ORIGEN_RECEPCION_LABELS, ESTADO_RECEPCION_LABELS } from '../types'

const MAX_ADJUNTO_BYTES = 10 * 1024 * 1024
// Solo .xlsx: ExcelJS (el lector del backend) no soporta el formato binario
// BIFF de .xls legado — QA-RCV-004.
const ACCEPT_ADJUNTO = '.xlsx'
const ITEM = 'COMPRAS_RECEPCION'

// El motor de Recepción (recepciones.motor.ts) junta TODOS los problemas de
// cada etapa en `error.details.diferencias`, no solo el primero — un toast
// (efímero, una sola línea) no alcanza para mostrarlos. `api.ts` ya deja el
// mensaje genérico en `error.message`; acá se lee el body crudo del ky
// HTTPError para sacar la lista completa y mostrarla como texto fijo en la
// página.
function diferenciasDelError(err: unknown): string[] {
  if (!isHTTPError(err)) return []
  const data = err.data as { error?: { details?: { diferencias?: unknown } } } | undefined
  const diferencias = data?.error?.details?.diferencias
  return Array.isArray(diferencias) ? diferencias.filter((d): d is string => typeof d === 'string') : []
}

// Modo PROCESO (2026-09-02): las diferencias contra el/los Instructivo(s) de
// Embalaje son una ADVERTENCIA aceptable/rechazable (todo o nada), no un
// error duro — el backend las distingue trayendo `advertencias` + `adjuntoId`
// en el detalle en vez de `diferencias` (ver diferenciasDelError arriba).
function advertenciasDelError(err: unknown): { items: string[]; adjuntoId: number } | null {
  if (!isHTTPError(err)) return null
  const data = err.data as { error?: { details?: { advertencias?: unknown; adjuntoId?: unknown } } } | undefined
  const advertencias = data?.error?.details?.advertencias
  const adjuntoId = data?.error?.details?.adjuntoId
  if (!Array.isArray(advertencias) || typeof adjuntoId !== 'number') return null
  const items = advertencias.filter((d): d is string => typeof d === 'string')
  return items.length > 0 ? { items, adjuntoId } : null
}

function formatoBytes(b: number): string {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`
  return `${(b / (1024 * 1024)).toFixed(1)} MB`
}

// Modos de Recepción (2026-10-01): solo Orden de Compra o Proceso. La
// Consignación se eliminó por decisión de negocio (ya no es un modo válido).
// OC valida contra las líneas de la OC; PROCESO valida contra folios de Calidad
// de los Instructivos.
type ModoRecepcion = 'OC' | 'PROCESO'

interface HeaderFields {
  modo: ModoRecepcion
  ordenCompraId: number | null
  instructivoIds: number[]
  plantaId: number
  direccionPlantaId: number
  templateCargaId: number | null
  observaciones: string
  // Temporada (2026-11-06): null en alta = la de la OC elegida o la activa.
  temporadaId: number | null
  // Solicitud de Inspección asociada (opcional, 2026-11-13).
  solicitudInspeccionId: number | null
}

const HEADER_EMPTY: HeaderFields = {
  modo: 'OC',
  ordenCompraId: null,
  instructivoIds: [],
  plantaId: 0,
  direccionPlantaId: 0,
  templateCargaId: null,
  observaciones: '',
  temporadaId: null,
  solicitudInspeccionId: null,
}

interface RecepcionFormProps {
  recepcionId?: number
}

export function RecepcionForm({ recepcionId }: RecepcionFormProps) {
  const isEdit = !!recepcionId
  const router = useRouter()
  const queryClient = useQueryClient()
  const puedeEscribir = usePuedeEscribir(ITEM)
  const inputAdjuntoRef = useRef<HTMLInputElement>(null)

  const [fields, setFields] = useState<HeaderFields>(HEADER_EMPTY)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [erroresCarga, setErroresCarga] = useState<{ mensaje: string; diferencias: string[] } | null>(null)
  const [advertencias, setAdvertencias] = useState<{ items: string[]; adjuntoId: number } | null>(null)
  const [descargandoFormato, setDescargandoFormato] = useState(false)
  // Popup de cantidad de filas para la descarga guiada por OC (2026-10-14).
  const [popupFilasOpen, setPopupFilasOpen] = useState(false)
  const [filasInput, setFilasInput] = useState('')
  const [cargandoSugerencia, setCargandoSugerencia] = useState(false)

  const { data: recepcion, isLoading } = useQuery({
    ...recepcionDetailOptions(recepcionId ?? 0),
    enabled: isEdit,
  })

  const { data: plantasData } = useQuery({
    queryKey: ['entidades-plantas-options'],
    queryFn: () => entidadesService.list({ tipo: 'PLANTA', limit: 500, activo: true }),
    staleTime: 60_000,
  })
  // Al asociar OC / Instructivos (2026-11-09): en alta solo se ofrecen los de la
  // temporada activa (selector general). En edición la asociación ya está
  // bloqueada y se listan sin filtro para no perder el nombre de una OC /
  // Instructivo de otra temporada.
  const { temporada: temporadaActiva, isLoading: temporadaCargando } = useTemporada()
  const temporadaFiltro = isEdit ? undefined : temporadaActiva?.id
  // Sin temporada activa (BCOG-R3-001) no se listan OC / Instructivos: se
  // mostrarían los de todas las temporadas.
  const sinTemporadaActiva = !isEdit && !temporadaCargando && temporadaFiltro == null
  const opcionesHabilitadas = isEdit || (!temporadaCargando && temporadaFiltro != null)
  // BCOG-R2-001: en alta, si cambia la temporada activa se descarta la OC /
  // Instructivos ya elegidos (pertenecían a la temporada anterior). Ajuste de
  // estado durante el render (sin useEffect), comparando con la temporada previa.
  const [temporadaFiltroPrevia, setTemporadaFiltroPrevia] = useState(temporadaFiltro)
  if (temporadaFiltro !== temporadaFiltroPrevia) {
    setTemporadaFiltroPrevia(temporadaFiltro)
    if (!isEdit) setFields((f) => (f.ordenCompraId == null && f.instructivoIds.length === 0 ? f : { ...f, ordenCompraId: null, instructivoIds: [] }))
  }
  const { data: ordenesCompraData } = useQuery({
    queryKey: ['ordenes-compra-emitidas-options', temporadaFiltro ?? null],
    // limit 100 = tope del contrato del listado de OC (ordenes-compra.schema.ts
    // .max(100)); se recorren todas las páginas (BCOG-R4-001) para que una
    // temporada con más de 100 OC emitidas no deje OC válidas fuera del combo.
    queryFn: async () => {
      const primera = await ordenesCompraService.list({ estado: 'EMITIDA', limit: 100, page: 1, temporadaId: temporadaFiltro })
      const restantes = await Promise.all(
        Array.from({ length: Math.max(primera.meta.totalPages - 1, 0) }, (_, i) =>
          ordenesCompraService.list({ estado: 'EMITIDA', limit: 100, page: i + 2, temporadaId: temporadaFiltro }),
        ),
      )
      return { ...primera, data: [...primera.data, ...restantes.flatMap((r) => r.data)] }
    },
    staleTime: 60_000,
    enabled: fields.modo === 'OC' && opcionesHabilitadas,
  })
  const { data: templatesCargaData } = useQuery({
    queryKey: ['templates-carga-options', 'RECEPCION'],
    queryFn: () => templatesCargaService.list({ tipo: 'RECEPCION' }),
    staleTime: 60_000,
  })
  const { data: instructivosData } = useQuery({
    queryKey: ['instructivos-embalaje-options', temporadaFiltro ?? null],
    // El backend pagina de a 100 (límite del contrato) — se recorren todas
    // las páginas acá porque el picker necesita el catálogo completo de una
    // vez (IMP-QA-R1-008, ronda 2: no hay búsqueda remota en SelectMultiple).
    // Sin filtro de estado (2026-09-02): el Instructivo ya no tiene veredicto,
    // así que todos los no eliminados son seleccionables.
    queryFn: async () => {
      const primera = await instructivoEmbalajeService.list({ limit: 100, page: 1, temporadaId: temporadaFiltro })
      const restantes = await Promise.all(
        Array.from({ length: primera.meta.totalPages - 1 }, (_, i) =>
          instructivoEmbalajeService.list({ limit: 100, page: i + 2, temporadaId: temporadaFiltro }),
        ),
      )
      return { ...primera, data: [...primera.data, ...restantes.flatMap((r) => r.data)] }
    },
    staleTime: 60_000,
    enabled: fields.modo === 'PROCESO' && opcionesHabilitadas,
  })
  const { data: plantaDetalle } = useQuery({
    ...entidadDetailOptions(fields.plantaId || 0),
    enabled: !!fields.plantaId,
  })

  const plantas = plantasData?.data ?? []
  const ordenesCompra = ordenesCompraData?.data ?? []
  // Temporada efectiva: la elegida; en alta, la de la OC seleccionada o la activa.
  const ocSeleccionada = fields.modo === 'OC' ? ordenesCompra.find((oc) => oc.id === fields.ordenCompraId) : undefined
  const temporadaIdEfectiva = fields.temporadaId ?? (isEdit ? null : ocSeleccionada?.temporadaId ?? temporadaActiva?.id ?? null)
  const templatesCarga = templatesCargaData?.data ?? []
  const instructivos = instructivosData?.data ?? []
  // Solicitudes de Inspección (opcional, 2026-11-13): de la temporada de la
  // Recepción y, con OC, solo las del productor de la OC.
  const ocParaSolicitud = fields.modo === 'OC' ? fields.ordenCompraId : null
  const { data: solicitudesData } = useQuery({
    queryKey: ['recepcion-opciones-solicitudes', temporadaIdEfectiva, ocParaSolicitud],
    queryFn: () => recepcionesService.opcionesSolicitudes({ temporadaId: temporadaIdEfectiva ?? undefined, ordenCompraId: ocParaSolicitud ?? undefined }),
    staleTime: 60_000,
    enabled: fields.modo === 'PROCESO' || !!ocParaSolicitud,
  })
  const opcionesSolicitud = (() => {
    const lista = (solicitudesData?.data ?? []).map((s) => ({ value: String(s.id), label: `${s.codigo} — ${s.entidadProductor.razonSocial}` }))
    // La ya asociada siempre visible aunque no entre en el filtro actual.
    const actual = recepcion?.data.solicitudInspeccion
    if (actual && !lista.some((o) => o.value === String(actual.id))) lista.unshift({ value: String(actual.id), label: actual.codigo })
    return [{ value: '__none__', label: 'Sin solicitud' }, ...lista]
  })()
  const direccionesPlanta = plantaDetalle?.direcciones ?? []

  useEffect(() => {
    if (recepcion) {
      const d = recepcion.data
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFields({
        modo: d.ordenCompraId ? 'OC' : 'PROCESO',
        ordenCompraId: d.ordenCompraId,
        instructivoIds: d.instructivos.map((i) => i.instructivo.id),
        plantaId: d.plantaId,
        direccionPlantaId: d.direccionPlantaId,
        templateCargaId: d.templateCargaId,
        observaciones: d.observaciones ?? '',
        temporadaId: d.temporadaId ?? null,
        solicitudInspeccionId: d.solicitudInspeccionId ?? null,
      })
    }
  }, [recepcion])

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (fields.modo === 'OC' && !fields.ordenCompraId) e.ordenCompraId = 'Selecciona la Orden de Compra'
    if (fields.modo === 'PROCESO' && fields.instructivoIds.length === 0) {
      e.instructivoIds = 'Selecciona al menos un Instructivo de Embalaje'
    }
    if (sinTemporadaActiva) {
      if (fields.modo === 'OC') e.ordenCompraId = 'Selecciona una temporada en el selector general para asociar la Orden de Compra'
      if (fields.modo === 'PROCESO') e.instructivoIds = 'Selecciona una temporada en el selector general para asociar Instructivos'
    }
    // En alta, la OC / Instructivos deben estar entre las opciones de la
    // temporada activa (defensa ante una selección que quedó de otra temporada).
    if (!isEdit && fields.modo === 'OC' && fields.ordenCompraId && !ordenesCompra.some((oc) => oc.id === fields.ordenCompraId)) {
      e.ordenCompraId = 'La Orden de Compra no pertenece a la temporada activa'
    }
    if (!isEdit && fields.modo === 'PROCESO' && fields.instructivoIds.some((id) => !instructivos.some((i) => i.id === id))) {
      e.instructivoIds = 'Uno o más Instructivos no pertenecen a la temporada activa'
    }
    if (!fields.plantaId) e.plantaId = 'La planta es requerida'
    if (!fields.direccionPlantaId) e.direccionPlantaId = 'La dirección de la planta es requerida'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function buildPayload(): RecepcionCreateInput {
    return {
      ordenCompraId: fields.modo === 'OC' ? fields.ordenCompraId : null,
      esProceso: fields.modo === 'PROCESO',
      instructivoIds: fields.modo === 'PROCESO' ? fields.instructivoIds : undefined,
      plantaId: fields.plantaId,
      direccionPlantaId: fields.direccionPlantaId,
      templateCargaId: fields.templateCargaId,
      observaciones: fields.observaciones.trim() || undefined,
      temporadaId: temporadaIdEfectiva,
      solicitudInspeccionId: fields.solicitudInspeccionId,
    }
  }

  const createMutation = useMutation({
    mutationFn: (data: RecepcionCreateInput) => recepcionesService.create(data),
    onSuccess: (res) => {
      toast.success(`Recepción creada — ${res.data.numero}`)
      queryClient.invalidateQueries({ queryKey: recepcionesKeys.all })
      router.push(`/dashboard/compras/recepciones/${res.data.id}`)
    },
    onError: (e: Error) => toast.error(e.message || 'Error al crear la Recepción'),
  })

  const updateMutation = useMutation({
    mutationFn: (data: RecepcionCreateInput) => recepcionesService.update(recepcionId!, data),
    onSuccess: () => {
      toast.success('Recepción actualizada')
      queryClient.invalidateQueries({ queryKey: recepcionesKeys.all })
      queryClient.invalidateQueries({ queryKey: recepcionesKeys.detail(recepcionId!) })
      // Al guardar cambios se vuelve al listado (2026-11-09).
      router.push('/dashboard/compras/recepciones')
    },
    onError: (e: Error) => toast.error(e.message || 'Error al actualizar la Recepción'),
  })

  const subirAdjuntoMutation = useMutation({
    mutationFn: (archivo: File) => recepcionesService.subirAdjunto(recepcionId!, archivo),
    onSuccess: () => {
      setErroresCarga(null)
      setAdvertencias(null)
      queryClient.invalidateQueries({ queryKey: recepcionesKeys.detail(recepcionId!) })
    },
    onError: (e: Error) => {
      // Modo PROCESO: las diferencias contra el Instructivo son una
      // advertencia aceptable/rechazable — se muestra un diálogo de
      // confirmación en vez del bloque de error genérico.
      const adv = advertenciasDelError(e)
      if (adv) {
        setAdvertencias(adv)
        return
      }
      toast.error(e.message || 'Error al subir el archivo')
      const diferencias = diferenciasDelError(e)
      if (diferencias.length > 0) {
        setErroresCarga({ mensaje: e.message, diferencias })
      }
    },
  })
  const eliminarAdjuntoMutation = useMutation({
    mutationFn: (adjuntoId: number) => recepcionesService.eliminarAdjunto(recepcionId!, adjuntoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: recepcionesKeys.detail(recepcionId!) })
    },
    onError: (e: Error) => toast.error(e.message || 'Error al eliminar el archivo'),
  })
  const confirmarAdvertenciasMutation = useMutation({
    mutationFn: (adjuntoId: number) => recepcionesService.confirmarAdvertencias(recepcionId!, adjuntoId),
    onSuccess: () => {
      toast.success('Carga confirmada con advertencias')
      setAdvertencias(null)
      queryClient.invalidateQueries({ queryKey: recepcionesKeys.detail(recepcionId!) })
    },
    onError: (e: Error) => {
      toast.error(e.message || 'Error al confirmar la carga')
      setAdvertencias(null)
    },
  })

  // Formato base simple (sin OC): Excel en blanco con las columnas del template.
  async function descargarFormatoBasePlano() {
    if (!fields.templateCargaId) return
    const tpl = templatesCarga.find((t) => t.id === fields.templateCargaId)
    setDescargandoFormato(true)
    try {
      await templatesCargaService.descargarFormatoBase(
        fields.templateCargaId,
        `Formato_${tpl?.codigo ?? 'carga'}.xlsx`,
      )
    } catch (e) {
      toast.error((e as Error).message || 'No se pudo descargar el formato base')
    } finally {
      setDescargandoFormato(false)
    }
  }

  // Click en "Formato base": con OC seleccionada abre el popup de cantidad de
  // filas (precarga sugerida = total de pallets de la OC); sin OC, descarga el
  // formato en blanco de siempre.
  async function onClickFormatoBase() {
    if (!fields.templateCargaId) return
    if (fields.modo !== 'OC' || !fields.ordenCompraId) {
      await descargarFormatoBasePlano()
      return
    }
    setCargandoSugerencia(true)
    setFilasInput('')
    setPopupFilasOpen(true)
    try {
      const { data: oc } = await ordenesCompraService.getById(fields.ordenCompraId)
      const totalPallets = oc.lineas.reduce((s, l) => s + (l.cantidadPallets ?? 0), 0)
      setFilasInput(totalPallets > 0 ? String(totalPallets) : '')
    } catch {
      // Si falla la sugerencia, el usuario igual puede tipear la cantidad.
      setFilasInput('')
    } finally {
      setCargandoSugerencia(false)
    }
  }

  // Descarga guiada por OC con la cantidad de filas confirmada en el popup.
  async function confirmarDescargaOc() {
    if (!fields.templateCargaId || !fields.ordenCompraId) return
    const filas = Number(filasInput)
    if (!Number.isInteger(filas) || filas < 1 || filas > 10000) {
      toast.error('Ingresa una cantidad de registros válida (1 a 10.000)')
      return
    }
    const tpl = templatesCarga.find((t) => t.id === fields.templateCargaId)
    setDescargandoFormato(true)
    try {
      await recepcionesService.descargarFormatoBaseOc(
        fields.templateCargaId,
        fields.ordenCompraId,
        filas,
        `Formato_${tpl?.codigo ?? 'carga'}_OC.xlsx`,
        fields.plantaId || null,
      )
      setPopupFilasOpen(false)
    } catch (e) {
      toast.error((e as Error).message || 'No se pudo descargar el formato base')
    } finally {
      setDescargandoFormato(false)
    }
  }

  function agregarArchivo(files: FileList | null) {
    if (!files || files.length === 0) return
    const f = files[0]
    setErroresCarga(null)
    if (f.size > MAX_ADJUNTO_BYTES) {
      toast.error(`"${f.name}" supera los 10 MB`)
    } else {
      subirAdjuntoMutation.mutate(f)
    }
    if (inputAdjuntoRef.current) inputAdjuntoRef.current.value = ''
  }

  function handleSubmit() {
    if (!validate()) {
      toast.error('Hay campos por corregir')
      return
    }
    const payload = buildPayload()
    if (isEdit) updateMutation.mutate(payload)
    else createMutation.mutate(payload)
  }

  if (isEdit && isLoading) {
    return <p className='text-sm text-muted-foreground'>Cargando…</p>
  }

  const isPending = createMutation.isPending || updateMutation.isPending
  // recepcion.data.editable ya viene calculado por el backend (QA-RCV-002,
  // recepciones.service.ts shapeRecepcion): CARGADA/RECHAZADA sin pallets
  // generados. En consignación el estado se queda en CARGADA aunque ya haya
  // generado pallets/Stock, así que el estado por sí solo no basta.
  const soloLectura = !puedeEscribir || (isEdit && !!recepcion && !recepcion.data.editable)
  const bloqueadaPorPallets = isEdit && !!recepcion && !recepcion.data.editable && recepcion.data.tienePallets

  return (
    <div className='space-y-6'>
      <Card>
        <CardHeader>
          <div className='flex items-center justify-between'>
            <CardTitle>{isEdit ? `Recepción ${recepcion?.data.numero}` : 'Nueva Recepción'}</CardTitle>
            {isEdit && recepcion && (
              <div className='flex gap-2'>
                <Badge variant='outline'>{ORIGEN_RECEPCION_LABELS[recepcion.data.origen]}</Badge>
                <Badge>{ESTADO_RECEPCION_LABELS[recepcion.data.estado]}</Badge>
                {recepcion.data.advertenciasAceptadas && <Badge variant='secondary'>Cargada con advertencias</Badge>}
              </div>
            )}
          </div>
          {bloqueadaPorPallets && (
            <p className='text-sm text-muted-foreground'>
              Esta Recepción ya generó pallets en Stock y no puede editarse ni cargar un nuevo Excel. Si su fruta no
              está en un Embarque ni en un Reclamo, puedes reabrirla o eliminarla desde el listado de Recepciones.
            </p>
          )}
          {recepcion?.data.advertenciasAceptadas && (
            <div className='space-y-1 rounded-md border border-amber-600/30 bg-amber-600/5 p-3 text-sm'>
              <p className='font-medium'>
                Cargada aceptando diferencias {recepcion.data.origen === 'COMPRA' ? 'de cantidad contra la Orden de Compra' : 'contra el/los Instructivo(s)'} — {recepcion.data.advertenciasAceptadasPor}
                {recepcion.data.advertenciasAceptadasEn
                  ? ` el ${new Date(recepcion.data.advertenciasAceptadasEn).toLocaleString('es-CL')}`
                  : ''}
              </p>
              <ul className='list-disc space-y-0.5 pl-4 text-xs text-muted-foreground'>
                {(recepcion.data.advertenciasDetalle ?? []).map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            </div>
          )}
        </CardHeader>
        <CardContent className='space-y-4'>
          {!isEdit && (
            <div className='space-y-1.5'>
              <Label>Modo de Recepción</Label>
              <RadioGroup
                className='grid-flow-col justify-start gap-4'
                value={fields.modo}
                onValueChange={(v) => setFields((f) => ({ ...f, modo: v as ModoRecepcion, ordenCompraId: null, instructivoIds: [], solicitudInspeccionId: null }))}
              >
                <div className='flex items-center gap-1.5'>
                  <RadioGroupItem value='OC' id='modo-oc' />
                  <Label htmlFor='modo-oc' className='font-normal'>Con Orden de Compra</Label>
                </div>
                <div className='flex items-center gap-1.5'>
                  <RadioGroupItem value='PROCESO' id='modo-proceso' />
                  <Label htmlFor='modo-proceso' className='font-normal'>Proceso</Label>
                </div>
              </RadioGroup>
            </div>
          )}

          {fields.modo === 'PROCESO' && (
            <div className='space-y-1.5'>
              <Label>Instructivo(s) de Embalaje <span className='text-destructive'>*</span></Label>
              <SelectMultiple
                options={instructivos.map((i) => ({
                  id: i.id,
                  label: `N° ${i.numero} - Sem ${semanaISO(i.fechaInicioPrograma) ?? '—'} - ${i.entidadProductor.descripcion}`,
                }))}
                selectedIds={fields.instructivoIds}
                onChange={(ids) => setFields((f) => ({ ...f, instructivoIds: ids }))}
                placeholder='Agregar instructivo...'
                disabled={soloLectura || isEdit || sinTemporadaActiva}
              />
              {sinTemporadaActiva && (
                <p className='text-xs text-amber-600'>Selecciona una temporada en el selector general para asociar Instructivos.</p>
              )}
              <p className='text-xs text-muted-foreground'>
                Se validará que la fruta del Excel coincida con las características de alguna línea de los Instructivos seleccionados. Si hay diferencias, se te pedirá confirmar si deseas cargar de todas formas.
              </p>
              {errors.instructivoIds && <p className='text-xs text-destructive'>{errors.instructivoIds}</p>}
            </div>
          )}

          {fields.modo === 'OC' && (
            <div className='space-y-1.5'>
              <Label>Orden de Compra <span className='text-destructive'>*</span></Label>
              <Combobox
                value={fields.ordenCompraId ? String(fields.ordenCompraId) : ''}
                onChange={(v) => setFields((f) => ({ ...f, ordenCompraId: Number(v), solicitudInspeccionId: null }))}
                placeholder='Seleccionar Orden de Compra...'
                searchPlaceholder='Buscar OC...'
                options={ordenesCompra.map((oc) => ({ value: String(oc.id), label: `${oc.numero} — ${oc.entidadProductor.descripcion}` }))}
                disabled={soloLectura || isEdit || sinTemporadaActiva}
              />
              {sinTemporadaActiva && (
                <p className='text-xs text-amber-600'>Selecciona una temporada en el selector general para asociar la Orden de Compra.</p>
              )}
              {errors.ordenCompraId && <p className='text-xs text-destructive'>{errors.ordenCompraId}</p>}
            </div>
          )}

          <div className='grid gap-4 sm:grid-cols-3'>
            <div className='space-y-1.5'>
              <Label>Temporada</Label>
              <TemporadaSelect
                value={temporadaIdEfectiva}
                onChange={(id) => setFields((f) => ({ ...f, temporadaId: id }))}
                disabled={soloLectura}
              />
            </div>
            <div className='space-y-1.5 sm:col-span-2'>
              <Label>Solicitud de Inspección <span className='text-muted-foreground text-xs'>(opcional)</span></Label>
              <Combobox
                value={fields.solicitudInspeccionId ? String(fields.solicitudInspeccionId) : '__none__'}
                onChange={(v) => setFields((f) => ({ ...f, solicitudInspeccionId: v && v !== '__none__' ? Number(v) : null }))}
                placeholder='Sin solicitud'
                searchPlaceholder='Buscar solicitud...'
                options={opcionesSolicitud}
                disabled={soloLectura || (fields.modo === 'OC' && !fields.ordenCompraId)}
              />
              {fields.modo === 'OC' && !fields.ordenCompraId && (
                <p className='text-xs text-muted-foreground'>Selecciona la Orden de Compra para ver sus solicitudes.</p>
              )}
            </div>
          </div>

          <Separator />

          <div className='grid gap-4 sm:grid-cols-3'>
            <div className='space-y-1.5'>
              <Label>Planta <span className='text-destructive'>*</span></Label>
              <Combobox
                value={fields.plantaId ? String(fields.plantaId) : ''}
                onChange={(v) => setFields((f) => ({ ...f, plantaId: Number(v), direccionPlantaId: 0 }))}
                placeholder='Seleccionar planta...'
                searchPlaceholder='Buscar planta...'
                options={plantas.map((p) => ({ value: String(p.id), label: p.descripcion }))}
                disabled={soloLectura}
              />
              {errors.plantaId && <p className='text-xs text-destructive'>{errors.plantaId}</p>}
            </div>
            <div className='space-y-1.5 sm:col-span-2'>
              <Label>Dirección de Retiro <span className='text-destructive'>*</span></Label>
              <Select
                value={fields.direccionPlantaId ? String(fields.direccionPlantaId) : ''}
                onValueChange={(v) => setFields((f) => ({ ...f, direccionPlantaId: Number(v) }))}
                disabled={soloLectura || !fields.plantaId}
              >
                <SelectTrigger className='w-full'><SelectValue placeholder='Seleccionar dirección...' /></SelectTrigger>
                <SelectContent>
                  {direccionesPlanta.map((d) => (
                    <SelectItem key={d.id} value={String(d.id)}>{d.descripcion} — {d.direccion}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.direccionPlantaId && <p className='text-xs text-destructive'>{errors.direccionPlantaId}</p>}
            </div>
          </div>

          <div className='space-y-1.5'>
            <Label>Template de Carga <span className='text-muted-foreground text-xs'>(opcional)</span></Label>
            <div className='flex items-center gap-2'>
              <Select
                value={fields.templateCargaId ? String(fields.templateCargaId) : '__none__'}
                onValueChange={(v) => setFields((f) => ({ ...f, templateCargaId: v === '__none__' ? null : Number(v) }))}
                disabled={soloLectura}
              >
                <SelectTrigger className='flex-1'><SelectValue placeholder='Sin template...' /></SelectTrigger>
                <SelectContent>
                  <SelectItem value='__none__'>Sin template</SelectItem>
                  {templatesCarga.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>{t.codigo} — {t.descripcion}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type='button'
                variant='outline'
                size='sm'
                disabled={!fields.templateCargaId || descargandoFormato}
                onClick={onClickFormatoBase}
              >
                <Icons.download className='mr-1 h-4 w-4' /> Formato base
              </Button>
            </div>
            <p className='text-xs text-muted-foreground'>
              Elige un template y descarga el Excel con sus columnas para llenarlo y subirlo. Con una Orden
              de Compra seleccionada, el formato viene con los datos de la OC precargados y validados.
            </p>
          </div>

          <div className='space-y-1.5'>
            <Label>Observaciones</Label>
            <Textarea
              rows={3}
              value={fields.observaciones}
              onChange={(e) => setFields((f) => ({ ...f, observaciones: e.target.value }))}
              disabled={soloLectura}
            />
          </div>

          {isEdit && (
            <div className='space-y-2'>
              <Label>Archivo Excel <span className='text-muted-foreground text-xs'>(opcional por ahora)</span></Label>
              {!soloLectura && (
                <>
                  <input
                    ref={inputAdjuntoRef}
                    type='file'
                    accept={ACCEPT_ADJUNTO}
                    className='hidden'
                    onChange={(e) => agregarArchivo(e.target.files)}
                  />
                  <Button type='button' variant='outline' size='sm' onClick={() => inputAdjuntoRef.current?.click()}>
                    <Icons.upload className='mr-1 h-4 w-4' /> Subir Excel
                  </Button>
                  <p className='text-xs text-muted-foreground'>Solo .xlsx. Máx. 10 MB.</p>
                </>
              )}
              {erroresCarga && (
                <div className='space-y-1.5 rounded-md border border-destructive/40 bg-destructive/5 p-3'>
                  <p className='text-sm font-medium text-destructive'>{erroresCarga.mensaje}</p>
                  <ul className='list-disc space-y-0.5 pl-4 text-xs text-destructive/90'>
                    {erroresCarga.diferencias.map((d, i) => (
                      <li key={i}>{d}</li>
                    ))}
                  </ul>
                </div>
              )}
              {(recepcion?.data.adjuntos ?? []).length > 0 && (
                <div className='space-y-1 rounded-md border p-2'>
                  {recepcion!.data.adjuntos.map((a) => (
                    <div key={a.id} className='flex items-center gap-2 text-sm'>
                      <Icons.paperclip className='h-4 w-4 shrink-0 text-muted-foreground' />
                      <a
                        href={recepcionesService.urlDescargaAdjunto(recepcionId!, a.id)}
                        target='_blank'
                        rel='noreferrer'
                        className='flex-1 truncate underline-offset-2 hover:underline'
                      >
                        {a.nombre}
                      </a>
                      <span className='text-xs text-muted-foreground'>{formatoBytes(a.tamano)}</span>
                      {!soloLectura && (
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
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {!soloLectura && <AvisoSinTemporada mostrar={sinTemporadaActiva} />}
      {!soloLectura && (
        <div className='flex justify-end'>
          <Button onClick={handleSubmit} isLoading={isPending} disabled={!isEdit && (temporadaCargando || temporadaFiltro == null)}>
            <Icons.check className='mr-1 h-4 w-4' /> {isEdit ? 'Guardar cambios' : 'Crear Recepción'}
          </Button>
        </div>
      )}

      <Modal
        title={fields.modo === 'OC' ? 'La carga tiene diferencias de cantidad con la Orden de Compra' : 'La carga no coincide con el Instructivo de Embalaje'}
        description={
          fields.modo === 'OC'
            ? 'La cantidad de pallets/cajas del Excel difiere de la Orden de Compra. Puedes corregir el Excel y volver a subirlo, o recepcionar de todas formas — se guardará como advertencia aceptada.'
            : 'Las siguientes filas no calzan con las características de los Instructivos seleccionados. Puedes corregir el Excel y volver a subirlo, o cargar de todas formas — se guardará como advertencia aceptada.'
        }
        isOpen={!!advertencias}
        onClose={() => setAdvertencias(null)}
      >
        <ul className='max-h-64 list-disc space-y-1 overflow-y-auto pl-4 text-sm'>
          {advertencias?.items.map((a, i) => <li key={i}>{a}</li>)}
        </ul>
        <div className='mt-6 flex justify-end gap-2'>
          <Button variant='outline' onClick={() => setAdvertencias(null)} disabled={confirmarAdvertenciasMutation.isPending}>
            Corregir Excel
          </Button>
          <Button
            onClick={() => advertencias && confirmarAdvertenciasMutation.mutate(advertencias.adjuntoId)}
            isLoading={confirmarAdvertenciasMutation.isPending}
          >
            Cargar de todas formas
          </Button>
        </div>
      </Modal>

      <Modal
        title='Descargar formato base de la Orden de Compra'
        description='El Excel se descarga con los datos de la OC precargados (especie, variedad, etc. cuando hay un solo valor) y con los campos de varios valores restringidos a lo permitido por la OC. Indica cuántos registros (filas) quieres generar.'
        isOpen={popupFilasOpen}
        onClose={() => setPopupFilasOpen(false)}
      >
        <div className='space-y-1.5'>
          <Label>Cantidad de registros a cargar <span className='text-destructive'>*</span></Label>
          <Input
            type='number'
            min={1}
            max={10000}
            value={filasInput}
            onChange={(e) => setFilasInput(e.target.value)}
            placeholder={cargandoSugerencia ? 'Calculando sugerencia…' : 'Ej: 20'}
            disabled={cargandoSugerencia}
          />
          <p className='text-xs text-muted-foreground'>Sugerido: total de pallets de la OC. Puedes ajustarlo.</p>
        </div>
        <div className='mt-6 flex justify-end gap-2'>
          <Button variant='outline' onClick={() => setPopupFilasOpen(false)} disabled={descargandoFormato}>
            Cancelar
          </Button>
          <Button onClick={confirmarDescargaOc} isLoading={descargandoFormato} disabled={cargandoSugerencia}>
            <Icons.download className='mr-1 h-4 w-4' /> Descargar
          </Button>
        </div>
      </Modal>
    </div>
  )
}
