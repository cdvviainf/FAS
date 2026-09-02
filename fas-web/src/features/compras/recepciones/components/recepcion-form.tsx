'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { isHTTPError } from 'ky'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
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
import { usePuedeEscribir } from '@/hooks/use-item-acceso'
import { entidadesService } from '@/features/entidades/service'
import { entidadDetailOptions } from '@/features/entidades/queries'
import { ordenesCompraService } from '@/features/compras/ordenes-compra/service'
import { templatesCargaService } from '@/features/templates-carga/service'
import { instructivoEmbalajeService } from '@/features/compras/instructivo-embalaje/service'
import { ESTADO_INSPECCION_LABELS } from '@/features/compras/instructivo-embalaje/types'
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

function formatoBytes(b: number): string {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`
  return `${(b / (1024 * 1024)).toFixed(1)} MB`
}

// Etapa 3 (2026-08-23): reemplaza el binario tieneOc por 3 modos — sin OC,
// CONSIGNACION y PROCESO no son distinguibles solo con un booleano (ambos
// dejan ordenCompraId en null; PROCESO valida contra folios de Calidad en
// vez de contra líneas de OC).
type ModoRecepcion = 'OC' | 'CONSIGNACION' | 'PROCESO'

interface HeaderFields {
  modo: ModoRecepcion
  ordenCompraId: number | null
  instructivoIds: number[]
  plantaId: number
  direccionPlantaId: number
  templateCargaId: number | null
  observaciones: string
}

const HEADER_EMPTY: HeaderFields = {
  modo: 'CONSIGNACION',
  ordenCompraId: null,
  instructivoIds: [],
  plantaId: 0,
  direccionPlantaId: 0,
  templateCargaId: null,
  observaciones: '',
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

  const { data: recepcion, isLoading } = useQuery({
    ...recepcionDetailOptions(recepcionId ?? 0),
    enabled: isEdit,
  })

  const { data: plantasData } = useQuery({
    queryKey: ['entidades-plantas-options'],
    queryFn: () => entidadesService.list({ tipo: 'PLANTA', limit: 500, activo: true }),
    staleTime: 60_000,
  })
  const { data: ordenesCompraData } = useQuery({
    queryKey: ['ordenes-compra-emitidas-options'],
    queryFn: () => ordenesCompraService.list({ estado: 'EMITIDA', limit: 200 }),
    staleTime: 60_000,
    enabled: fields.modo === 'OC',
  })
  const { data: templatesCargaData } = useQuery({
    queryKey: ['templates-carga-options', 'RECEPCION'],
    queryFn: () => templatesCargaService.list({ tipo: 'RECEPCION' }),
    staleTime: 60_000,
  })
  const { data: instructivosData } = useQuery({
    queryKey: ['instructivos-embalaje-seleccionables-options'],
    // El backend pagina de a 100 (límite del contrato) — se recorren todas
    // las páginas acá porque el picker necesita el catálogo completo de una
    // vez (IMP-QA-R1-008, ronda 2: no hay búsqueda remota en SelectMultiple).
    queryFn: async () => {
      const primera = await instructivoEmbalajeService.list({ seleccionable: true, limit: 100, page: 1 })
      const restantes = await Promise.all(
        Array.from({ length: primera.meta.totalPages - 1 }, (_, i) =>
          instructivoEmbalajeService.list({ seleccionable: true, limit: 100, page: i + 2 }),
        ),
      )
      return { ...primera, data: [...primera.data, ...restantes.flatMap((r) => r.data)] }
    },
    staleTime: 60_000,
    enabled: fields.modo === 'PROCESO',
  })
  const { data: plantaDetalle } = useQuery({
    ...entidadDetailOptions(fields.plantaId || 0),
    enabled: !!fields.plantaId,
  })

  const plantas = plantasData?.data ?? []
  const ordenesCompra = ordenesCompraData?.data ?? []
  const templatesCarga = templatesCargaData?.data ?? []
  const instructivos = instructivosData?.data ?? []
  const direccionesPlanta = plantaDetalle?.direcciones ?? []

  useEffect(() => {
    if (recepcion) {
      const d = recepcion.data
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFields({
        modo: d.ordenCompraId ? 'OC' : d.origen === 'PROCESO' ? 'PROCESO' : 'CONSIGNACION',
        ordenCompraId: d.ordenCompraId,
        instructivoIds: d.instructivos.map((i) => i.instructivo.id),
        plantaId: d.plantaId,
        direccionPlantaId: d.direccionPlantaId,
        templateCargaId: d.templateCargaId,
        observaciones: d.observaciones ?? '',
      })
    }
  }, [recepcion])

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (fields.modo === 'OC' && !fields.ordenCompraId) e.ordenCompraId = 'Selecciona la Orden de Compra'
    if (fields.modo === 'PROCESO' && fields.instructivoIds.length === 0) {
      e.instructivoIds = 'Selecciona al menos un Instructivo de Embalaje'
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
    },
    onError: (e: Error) => toast.error(e.message || 'Error al actualizar la Recepción'),
  })

  const subirAdjuntoMutation = useMutation({
    mutationFn: (archivo: File) => recepcionesService.subirAdjunto(recepcionId!, archivo),
    onSuccess: () => {
      setErroresCarga(null)
      queryClient.invalidateQueries({ queryKey: recepcionesKeys.detail(recepcionId!) })
    },
    onError: (e: Error) => {
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
              </div>
            )}
          </div>
          {bloqueadaPorPallets && (
            <p className='text-sm text-muted-foreground'>
              Esta Recepción ya generó pallets en Stock y no puede editarse, cargar un nuevo Excel ni eliminarse,
              aunque el estado siga en {ESTADO_RECEPCION_LABELS.CARGADA}.
            </p>
          )}
        </CardHeader>
        <CardContent className='space-y-4'>
          {!isEdit && (
            <div className='space-y-1.5'>
              <Label>Modo de Recepción</Label>
              <RadioGroup
                className='grid-flow-col justify-start gap-4'
                value={fields.modo}
                onValueChange={(v) => setFields((f) => ({ ...f, modo: v as ModoRecepcion, ordenCompraId: null, instructivoIds: [] }))}
              >
                <div className='flex items-center gap-1.5'>
                  <RadioGroupItem value='OC' id='modo-oc' />
                  <Label htmlFor='modo-oc' className='font-normal'>Con Orden de Compra</Label>
                </div>
                <div className='flex items-center gap-1.5'>
                  <RadioGroupItem value='CONSIGNACION' id='modo-consignacion' />
                  <Label htmlFor='modo-consignacion' className='font-normal'>Consignación</Label>
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
                  label: `N° ${i.numero} — ${i.entidadProductor.descripcion} (${ESTADO_INSPECCION_LABELS[i.estadoInspeccion]})`,
                }))}
                selectedIds={fields.instructivoIds}
                onChange={(ids) => setFields((f) => ({ ...f, instructivoIds: ids }))}
                placeholder='Agregar instructivo...'
                disabled={soloLectura || isEdit}
              />
              <p className='text-xs text-muted-foreground'>
                Cada N° de Pallet del Excel debe corresponder a un folio Aprobado por Calidad en alguno de los Instructivos seleccionados, con características compatibles con alguna de sus líneas.
              </p>
              {errors.instructivoIds && <p className='text-xs text-destructive'>{errors.instructivoIds}</p>}
            </div>
          )}

          {fields.modo === 'OC' && (
            <div className='space-y-1.5'>
              <Label>Orden de Compra <span className='text-destructive'>*</span></Label>
              <Combobox
                value={fields.ordenCompraId ? String(fields.ordenCompraId) : ''}
                onChange={(v) => setFields((f) => ({ ...f, ordenCompraId: Number(v) }))}
                placeholder='Seleccionar Orden de Compra...'
                searchPlaceholder='Buscar OC...'
                options={ordenesCompra.map((oc) => ({ value: String(oc.id), label: `${oc.numero} — ${oc.entidadProductor.descripcion}` }))}
                disabled={soloLectura || isEdit}
              />
              {errors.ordenCompraId && <p className='text-xs text-destructive'>{errors.ordenCompraId}</p>}
            </div>
          )}

          <Separator />

          <div className='grid gap-4 sm:grid-cols-2'>
            <div className='space-y-1.5'>
              <Label>Planta <span className='text-destructive'>*</span></Label>
              <Combobox
                value={fields.plantaId ? String(fields.plantaId) : ''}
                onChange={(v) => setFields((f) => ({ ...f, plantaId: Number(v), direccionPlantaId: 0 }))}
                placeholder='Seleccionar planta...'
                searchPlaceholder='Buscar planta...'
                options={plantas.map((p) => ({ value: String(p.id), label: `${p.descripcion} — ${p.razonSocial}` }))}
                disabled={soloLectura}
              />
              {errors.plantaId && <p className='text-xs text-destructive'>{errors.plantaId}</p>}
            </div>
            <div className='space-y-1.5'>
              <Label>Dirección de Retiro <span className='text-destructive'>*</span></Label>
              <Select
                value={fields.direccionPlantaId ? String(fields.direccionPlantaId) : ''}
                onValueChange={(v) => setFields((f) => ({ ...f, direccionPlantaId: Number(v) }))}
                disabled={soloLectura || !fields.plantaId}
              >
                <SelectTrigger><SelectValue placeholder='Seleccionar dirección...' /></SelectTrigger>
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
            <Select
              value={fields.templateCargaId ? String(fields.templateCargaId) : '__none__'}
              onValueChange={(v) => setFields((f) => ({ ...f, templateCargaId: v === '__none__' ? null : Number(v) }))}
              disabled={soloLectura}
            >
              <SelectTrigger><SelectValue placeholder='Sin template...' /></SelectTrigger>
              <SelectContent>
                <SelectItem value='__none__'>Sin template</SelectItem>
                {templatesCarga.map((t) => (
                  <SelectItem key={t.id} value={String(t.id)}>{t.codigo} — {t.descripcion}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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

      {!soloLectura && (
        <div className='flex justify-end'>
          <Button onClick={handleSubmit} isLoading={isPending}>
            <Icons.check className='mr-1 h-4 w-4' /> {isEdit ? 'Guardar cambios' : 'Crear Recepción'}
          </Button>
        </div>
      )}
    </div>
  )
}
