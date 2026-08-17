'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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
import { usePuedeEscribir } from '@/hooks/use-item-acceso'
import { entidadesService } from '@/features/entidades/service'
import { entidadDetailOptions } from '@/features/entidades/queries'
import { ordenesCompraService } from '@/features/compras/ordenes-compra/service'
import { templatesCargaService } from '@/features/templates-carga/service'
import { recepcionDetailOptions, recepcionesKeys } from '../queries'
import { recepcionesService } from '../service'
import type { RecepcionCreateInput } from '../types'
import { ORIGEN_RECEPCION_LABELS, ESTADO_RECEPCION_LABELS } from '../types'

const MAX_ADJUNTO_BYTES = 10 * 1024 * 1024
// Solo .xlsx: ExcelJS (el lector del backend) no soporta el formato binario
// BIFF de .xls legado — QA-RCV-004.
const ACCEPT_ADJUNTO = '.xlsx'
const ITEM = 'COMPRAS_RECEPCION'

function formatoBytes(b: number): string {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`
  return `${(b / (1024 * 1024)).toFixed(1)} MB`
}

type TieneOc = 'SI' | 'NO'

interface HeaderFields {
  tieneOc: TieneOc
  ordenCompraId: number | null
  plantaId: number
  direccionPlantaId: number
  templateCargaId: number | null
  observaciones: string
}

const HEADER_EMPTY: HeaderFields = {
  tieneOc: 'NO',
  ordenCompraId: null,
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
    enabled: fields.tieneOc === 'SI',
  })
  const { data: templatesCargaData } = useQuery({
    queryKey: ['templates-carga-options', 'RECEPCION'],
    queryFn: () => templatesCargaService.list({ tipo: 'RECEPCION' }),
    staleTime: 60_000,
  })
  const { data: plantaDetalle } = useQuery({
    ...entidadDetailOptions(fields.plantaId || 0),
    enabled: !!fields.plantaId,
  })

  const plantas = plantasData?.data ?? []
  const ordenesCompra = ordenesCompraData?.data ?? []
  const templatesCarga = templatesCargaData?.data ?? []
  const direccionesPlanta = plantaDetalle?.direcciones ?? []

  useEffect(() => {
    if (recepcion) {
      const d = recepcion.data
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFields({
        tieneOc: d.ordenCompraId ? 'SI' : 'NO',
        ordenCompraId: d.ordenCompraId,
        plantaId: d.plantaId,
        direccionPlantaId: d.direccionPlantaId,
        templateCargaId: d.templateCargaId,
        observaciones: d.observaciones ?? '',
      })
    }
  }, [recepcion])

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (fields.tieneOc === 'SI' && !fields.ordenCompraId) e.ordenCompraId = 'Selecciona la Orden de Compra'
    if (!fields.plantaId) e.plantaId = 'La planta es requerida'
    if (!fields.direccionPlantaId) e.direccionPlantaId = 'La dirección de la planta es requerida'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function buildPayload(): RecepcionCreateInput {
    return {
      ordenCompraId: fields.tieneOc === 'SI' ? fields.ordenCompraId : null,
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
      queryClient.invalidateQueries({ queryKey: recepcionesKeys.detail(recepcionId!) })
    },
    onError: (e: Error) => toast.error(e.message || 'Error al subir el archivo'),
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
  const soloLectura = !puedeEscribir || (isEdit && recepcion?.data.estado !== 'CARGADA')

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
        </CardHeader>
        <CardContent className='space-y-4'>
          {!isEdit && (
            <div className='space-y-1.5'>
              <Label>¿Con Orden de Compra?</Label>
              <RadioGroup
                className='grid-flow-col justify-start gap-4'
                value={fields.tieneOc}
                onValueChange={(v) => setFields((f) => ({ ...f, tieneOc: v as TieneOc, ordenCompraId: null }))}
              >
                <div className='flex items-center gap-1.5'>
                  <RadioGroupItem value='SI' id='tieneOc-si' />
                  <Label htmlFor='tieneOc-si' className='font-normal'>Sí — Compra</Label>
                </div>
                <div className='flex items-center gap-1.5'>
                  <RadioGroupItem value='NO' id='tieneOc-no' />
                  <Label htmlFor='tieneOc-no' className='font-normal'>No — Consignación</Label>
                </div>
              </RadioGroup>
            </div>
          )}

          {fields.tieneOc === 'SI' && (
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
