'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AlertModal } from '@/components/modal/alert-modal'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Icons } from '@/components/icons'
import { Badge } from '@/components/ui/badge'
import { Combobox } from '@/components/ui/combobox'
import { usePuedeEscribir } from '@/hooks/use-item-acceso'
import { DocumentoPreviewDialog } from '@/features/documentos/components/documento-preview-dialog'
import { createMantenedorService } from '@/features/mantenedor-simple/service'
import { MantenedorQuickCreate } from '@/components/shared/mantenedor-simple/mantenedor-quick-create'
import { MonedaQuickCreate } from '@/features/monedas/components/moneda-quick-create'
import { condicionesPagoService } from '@/features/condiciones-pago/service'
import { FECHA_REFERENCIA_LABELS } from '@/features/condiciones-pago/types'
import type { MantenedorSimple, MantenedorSimpleListResponse } from '@/features/mantenedor-simple/types'
import { entidadesService } from '@/features/entidades/service'
import { articulosService } from '@/features/materiales/articulos/service'
import { formatMonto } from '@/lib/format'
import { proformaProductorDetailOptions, proformasProductorKeys } from '../queries'
import { proformasProductorService } from '../service'
import type {
  ProformaProductorCreateInput,
  ProformaProductorLineaInput,
} from '../types'
import { ESTADO_PROFORMA_PRODUCTOR_LABELS } from '../types'

const monedasService = createMantenedorService('monedas')
const formasPagoService = createMantenedorService('formas-pago')
const conceptosCtaCteService = createMantenedorService('conceptos-cta-cte')

interface HeaderFields {
  entidadId: number
  formaPagoId: number | null
  condicionPagoId: number | null
  conceptoCtaCteId: number | null
  monedaId: number
  observaciones: string
}

// Línea en edición local: ids/números como string para el input controlado.
interface LineaEdit {
  articuloId: number
  cantidad: string
  precioUnitario: string
  exento: boolean
}

const HEADER_EMPTY: HeaderFields = {
  entidadId: 0,
  formaPagoId: null,
  condicionPagoId: null,
  conceptoCtaCteId: null,
  monedaId: 0,
  observaciones: '',
}

const LINEA_EMPTY: LineaEdit = { articuloId: 0, cantidad: '1', precioUnitario: '0', exento: false }

const round2 = (n: number) => Math.round(n * 100) / 100

interface ProformaProductorFormProps {
  proformaProductorId?: number
}

const ITEM = 'PRODUCTORES_PROFORMA'

export function ProformaProductorForm({ proformaProductorId }: ProformaProductorFormProps) {
  const isEdit = !!proformaProductorId
  const router = useRouter()
  const queryClient = useQueryClient()
  const puedeEscribir = usePuedeEscribir(ITEM)

  function agregarAOpciones(queryKey: unknown[], item: MantenedorSimple) {
    queryClient.setQueryData<MantenedorSimpleListResponse>(queryKey, (old) =>
      old ? { ...old, data: [...old.data, item] } : old,
    )
  }

  const [fields, setFields] = useState<HeaderFields>({ ...HEADER_EMPTY })
  const [lineas, setLineas] = useState<LineaEdit[]>(isEdit ? [] : [{ ...LINEA_EMPTY }])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [anularOpen, setAnularOpen] = useState(false)
  const [enviarOpen, setEnviarOpen] = useState(false)
  const [rechazarOpen, setRechazarOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)

  const { data: proforma, isLoading } = useQuery({
    ...proformaProductorDetailOptions(proformaProductorId ?? 0),
    enabled: isEdit,
  })

  const { data: productoresData } = useQuery({
    queryKey: ['entidades-productores-options'],
    queryFn: () => entidadesService.list({ tipo: 'PRODUCTOR', activo: true, limit: 500 }),
    staleTime: 60_000,
  })
  const { data: articulosData } = useQuery({
    queryKey: ['articulos-servicio-options'],
    queryFn: () => articulosService.list({ tipo: 'SERVICIO', activo: true, limit: 500 }),
    staleTime: 60_000,
  })
  const { data: condicionesPagoData } = useQuery({
    queryKey: ['condiciones-pago-options', 'VENTA'],
    queryFn: () => condicionesPagoService.list({ tipo: 'VENTA' }),
    staleTime: 60_000,
  })
  const { data: formasPagoData } = useQuery({ queryKey: ['formas-pago-options'], queryFn: () => formasPagoService.list({ limit: 200, soloActivos: true }), staleTime: 5 * 60_000 })
  const { data: monedasData } = useQuery({ queryKey: ['monedas-options'], queryFn: () => monedasService.list({ limit: 200 }), staleTime: 5 * 60_000 })
  const { data: conceptosCtaCteData } = useQuery({ queryKey: ['conceptos-cta-cte-options'], queryFn: () => conceptosCtaCteService.list({ soloActivos: true, limit: 500 }), staleTime: 5 * 60_000 })

  const productores = productoresData?.data ?? []
  const articulos = articulosData?.data ?? []
  // La factura al productor es un cargo (DEBE) → solo conceptos DEBE o AMBOS.
  const conceptosCtaCte = (conceptosCtaCteData?.data ?? []).filter(
    (c) => (c as { naturaleza?: string }).naturaleza !== 'HABER',
  )

  const condicionPagoSeleccionada = (condicionesPagoData?.data ?? []).find((c) => c.id === fields.condicionPagoId)
  const cuotasPreview = isEdit ? proforma?.data.cuotasPago ?? [] : condicionPagoSeleccionada?.cuotas ?? []

  useEffect(() => {
    if (proforma) {
      const d = proforma.data
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza el estado local del form con la respuesta del server al cargar/refrescar (mismo patrón que proforma-material-form.tsx)
      setFields({
        entidadId: d.entidadId,
        formaPagoId: d.formaPagoId,
        condicionPagoId: d.condicionPagoId,
        conceptoCtaCteId: d.conceptoCtaCteId,
        monedaId: d.monedaId,
        observaciones: d.observaciones ?? '',
      })
      setLineas(
        d.lineas.map((l) => ({
          articuloId: l.articuloId,
          cantidad: l.cantidad,
          precioUnitario: l.precioUnitario,
          exento: l.exento,
        })),
      )
    }
  }, [proforma])

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!fields.entidadId) e.entidadId = 'El productor es requerido'
    if (!fields.monedaId) e.monedaId = 'La moneda es requerida'
    if (lineas.length === 0) e.lineas = 'Agrega al menos una línea'
    if (lineas.some((l) => !l.articuloId)) e.lineas = 'Cada línea debe tener un artículo de servicio'
    if (lineas.some((l) => Number(l.cantidad) <= 0)) e.lineas = 'La cantidad de cada línea debe ser mayor a 0'
    if (lineas.some((l) => Number(l.precioUnitario) < 0)) e.lineas = 'El precio no puede ser negativo'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function buildLineasPayload(): ProformaProductorLineaInput[] {
    return lineas.map((l) => ({
      articuloId: l.articuloId,
      cantidad: Number(l.cantidad),
      precioUnitario: Number(l.precioUnitario),
      exento: l.exento,
    }))
  }

  function buildCreatePayload(): ProformaProductorCreateInput {
    return {
      entidadId: fields.entidadId,
      monedaId: fields.monedaId,
      formaPagoId: fields.formaPagoId,
      condicionPagoId: fields.condicionPagoId,
      conceptoCtaCteId: fields.conceptoCtaCteId,
      observaciones: fields.observaciones.trim() || undefined,
      lineas: buildLineasPayload(),
    }
  }

  const createMutation = useMutation({
    mutationFn: (data: ProformaProductorCreateInput) => proformasProductorService.create(data),
    onSuccess: (res) => {
      toast.success(`Proforma a Productor creada — ${res.data.numero}`)
      queryClient.invalidateQueries({ queryKey: proformasProductorKeys.all })
      router.push(`/dashboard/productores/proformas/${res.data.id}`)
    },
    onError: (e: Error) => toast.error(e.message || 'Error al crear la Proforma'),
  })

  const updateMutation = useMutation({
    mutationFn: (data: ProformaProductorCreateInput) => proformasProductorService.update(proformaProductorId!, data),
    onSuccess: () => {
      toast.success('Proforma actualizada')
      queryClient.invalidateQueries({ queryKey: proformasProductorKeys.detail(proformaProductorId!) })
    },
    onError: (e: Error) => toast.error(e.message || 'Error al actualizar la Proforma'),
  })

  const enviarValidacionMutation = useMutation({
    mutationFn: () => proformasProductorService.enviarValidacion(proformaProductorId!),
    onSuccess: () => {
      toast.success('Proforma enviada a validación')
      setEnviarOpen(false)
      queryClient.invalidateQueries({ queryKey: proformasProductorKeys.detail(proformaProductorId!) })
    },
    onError: (e: Error) => {
      toast.error(e.message || 'Error al enviar a validación')
      setEnviarOpen(false)
    },
  })

  const rechazarMutation = useMutation({
    mutationFn: () => proformasProductorService.rechazar(proformaProductorId!),
    onSuccess: () => {
      toast.success('Proforma rechazada — queda editable para corregir y reenviar')
      setRechazarOpen(false)
      queryClient.invalidateQueries({ queryKey: proformasProductorKeys.all })
      queryClient.invalidateQueries({ queryKey: proformasProductorKeys.detail(proformaProductorId!) })
    },
    onError: (e: Error) => {
      toast.error(e.message || 'Error al rechazar la Proforma')
      setRechazarOpen(false)
    },
  })

  const anularMutation = useMutation({
    mutationFn: () => proformasProductorService.anular(proformaProductorId!),
    onSuccess: () => {
      toast.success('Proforma anulada')
      setAnularOpen(false)
      queryClient.invalidateQueries({ queryKey: proformasProductorKeys.all })
      queryClient.invalidateQueries({ queryKey: proformasProductorKeys.detail(proformaProductorId!) })
    },
    onError: (e: Error) => {
      toast.error(e.message || 'Error al anular la Proforma')
      setAnularOpen(false)
    },
  })

  function handleSubmit() {
    if (!validate()) {
      toast.error('Hay campos por corregir')
      return
    }
    if (isEdit) updateMutation.mutate(buildCreatePayload())
    else createMutation.mutate(buildCreatePayload())
  }

  function setLinea(idx: number, patch: Partial<LineaEdit>) {
    setLineas((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)))
  }
  function agregarLinea() {
    setLineas((prev) => [...prev, { ...LINEA_EMPTY }])
  }
  function quitarLinea(idx: number) {
    setLineas((prev) => prev.filter((_, i) => i !== idx))
  }

  if (isEdit && isLoading) {
    return <p className='text-sm text-muted-foreground'>Cargando…</p>
  }

  const isPending = createMutation.isPending || updateMutation.isPending
  const estado = proforma?.data.estado
  // BORRADOR y RECHAZADA son editables (una proforma rechazada se corrige y reenvía).
  const editable = estado === 'BORRADOR' || estado === 'RECHAZADA'
  const soloLectura = !puedeEscribir || (isEdit && !editable)
  const puedeAnular = puedeEscribir && (estado === 'BORRADOR' || estado === 'ENVIADA_VALIDACION' || estado === 'RECHAZADA')
  const puedeRechazar = puedeEscribir && estado === 'ENVIADA_VALIDACION'
  const todasConPrecio = lineas.length > 0 && lineas.every((l) => Number(l.precioUnitario) > 0 && l.articuloId > 0)
  const puedeEnviarValidacion = puedeEscribir && editable && todasConPrecio && fields.conceptoCtaCteId != null

  const totalProforma = lineas.reduce((acc, l) => acc + round2(Number(l.cantidad) * Number(l.precioUnitario)), 0)

  return (
    <div className='space-y-6'>
      {isEdit && proforma && (
        <div className='flex flex-wrap items-center gap-2'>
          <Badge variant={estado === 'BORRADOR' ? 'secondary' : estado === 'ENVIADA_VALIDACION' ? 'default' : estado === 'ANULADA' || estado === 'RECHAZADA' ? 'destructive' : 'outline'}>
            {ESTADO_PROFORMA_PRODUCTOR_LABELS[proforma.data.estado]}
          </Badge>
          {soloLectura && (
            <span className='text-xs text-muted-foreground'>
              {!puedeEscribir
                ? 'Solo lectura — sin permiso de edición'
                : estado === 'ENVIADA_VALIDACION'
                  ? 'Enviada a validación — previsualiza para revisar; acéptala facturándola desde Facturas Nacionales, o recházala para corregir.'
                  : estado === 'FACTURADA'
                    ? 'Facturada — no editable.'
                    : 'Anulada — no editable.'}
            </span>
          )}
          {estado === 'RECHAZADA' && (
            <span className='text-xs text-muted-foreground'>
              Rechazada — corrige y vuelve a enviar a validación.
            </span>
          )}
          <Button type='button' variant='outline' size='sm' className='ml-auto' onClick={() => setPreviewOpen(true)}>
            <Icons.search className='mr-1 h-4 w-4' /> Previsualizar
          </Button>
        </div>
      )}

      <fieldset disabled={soloLectura} className='m-0 space-y-6 border-0 p-0'>
        <Card>
          <CardHeader>
            <CardTitle>{isEdit ? `Proforma a Productor ${proforma?.data.numero}` : 'Nueva Proforma a Productor'}</CardTitle>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='space-y-1.5'>
              <Label>Productor <span className='text-destructive'>*</span></Label>
              <Combobox
                value={fields.entidadId ? String(fields.entidadId) : ''}
                onChange={(v) => setFields((f) => ({ ...f, entidadId: Number(v) }))}
                placeholder='Seleccionar productor...'
                searchPlaceholder='Buscar productor...'
                options={productores.map((p) => ({
                  value: String(p.id),
                  label: `${p.descripcion} — ${p.razonSocial}`,
                }))}
                disabled={soloLectura}
              />
              {errors.entidadId && <p className='text-xs text-destructive'>{errors.entidadId}</p>}
              <p className='text-xs text-muted-foreground'>
                Para facturar, el productor debe ser también Cliente Nacional con RUT configurado en Entidades.
              </p>
            </div>

            <Separator />

            <div className='grid gap-4 sm:grid-cols-3'>
              <div className='space-y-1.5'>
                <Label>Forma de Pago</Label>
                <div className='flex gap-2'>
                  <Select value={fields.formaPagoId ? String(fields.formaPagoId) : '__none__'} onValueChange={(v) => setFields((f) => ({ ...f, formaPagoId: v === '__none__' ? null : Number(v) }))}>
                    <SelectTrigger className='flex-1'><SelectValue placeholder='Sin definir' /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value='__none__'>Sin definir</SelectItem>
                      {(formasPagoData?.data ?? []).map((f) => (
                        <SelectItem key={f.id} value={String(f.id)}>{f.descripcion}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <MantenedorQuickCreate
                    recurso='formas-pago'
                    titulo='Forma de Pago'
                    onCreated={(fp) => {
                      agregarAOpciones(['formas-pago-options'], fp)
                      setFields((f) => ({ ...f, formaPagoId: fp.id }))
                    }}
                  />
                </div>
              </div>
              <div className='space-y-1.5'>
                <Label>Condición de Pago</Label>
                <Select value={fields.condicionPagoId ? String(fields.condicionPagoId) : '__none__'} onValueChange={(v) => setFields((f) => ({ ...f, condicionPagoId: v === '__none__' ? null : Number(v) }))}>
                  <SelectTrigger><SelectValue placeholder='Sin definir' /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value='__none__'>Sin definir</SelectItem>
                    {(condicionesPagoData?.data ?? []).map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.descripcion}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className='text-xs text-muted-foreground'>Solo se aceptan condiciones de Venta con cuotas 100% porcentaje.</p>
              </div>
              <div className='space-y-1.5'>
                <Label>Moneda <span className='text-destructive'>*</span></Label>
                <div className='flex gap-2'>
                  <Select value={fields.monedaId ? String(fields.monedaId) : ''} onValueChange={(v) => setFields((f) => ({ ...f, monedaId: Number(v) }))}>
                    <SelectTrigger className='flex-1'><SelectValue placeholder='Seleccionar...' /></SelectTrigger>
                    <SelectContent>
                      {(monedasData?.data ?? []).map((m) => (
                        <SelectItem key={m.id} value={String(m.id)}>{m.codigo} — {m.descripcion}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <MonedaQuickCreate
                    onCreated={(m) => {
                      agregarAOpciones(['monedas-options'], m)
                      setFields((f) => ({ ...f, monedaId: m.id }))
                    }}
                  />
                </div>
                {errors.monedaId && <p className='text-xs text-destructive'>{errors.monedaId}</p>}
                <p className='text-xs text-muted-foreground'>La Factura Nacional exige CLP.</p>
              </div>
            </div>

            <div className='space-y-1.5'>
              <Label>Concepto de Cuenta Corriente</Label>
              <Select
                value={fields.conceptoCtaCteId ? String(fields.conceptoCtaCteId) : '__none__'}
                onValueChange={(v) => setFields((f) => ({ ...f, conceptoCtaCteId: v === '__none__' ? null : Number(v) }))}
              >
                <SelectTrigger className='sm:max-w-md'><SelectValue placeholder='Sin definir' /></SelectTrigger>
                <SelectContent>
                  <SelectItem value='__none__'>Sin definir</SelectItem>
                  {conceptosCtaCte.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.codigo} — {c.descripcion}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className='text-xs text-muted-foreground'>
                Requerido para enviar a validación. Al emitir la factura se registra un cargo (DEBE) en la cuenta corriente del productor con este concepto. Solo se listan conceptos DEBE o AMBOS.
              </p>
            </div>

            {cuotasPreview.length > 0 && (
              <div className='rounded-md border p-3'>
                <p className='mb-2 text-xs font-medium text-muted-foreground'>Cuotas de pago (determinadas por la Condición de Pago)</p>
                <div className='flex flex-wrap gap-2'>
                  {cuotasPreview.map((c, i) => (
                    <Badge key={i} variant='outline'>
                      {c.porcentaje}% a {c.plazoDias} días desde {FECHA_REFERENCIA_LABELS[c.fechaReferencia]}{c.descripcion ? ` — ${c.descripcion}` : ''}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <Separator />

            <div className='space-y-1.5'>
              <Label>Observaciones</Label>
              <Textarea value={fields.observaciones} onChange={(e) => setFields((f) => ({ ...f, observaciones: e.target.value }))} rows={2} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Líneas de Servicio</CardTitle>
          </CardHeader>
          <CardContent className='space-y-3'>
            <div className='overflow-x-auto rounded-md border'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className='min-w-[260px]'>Servicio</TableHead>
                    <TableHead className='w-28'>Cantidad</TableHead>
                    <TableHead className='w-32'>Precio Unitario</TableHead>
                    <TableHead className='w-20 text-center'>Exento</TableHead>
                    <TableHead className='w-32 text-right'>Monto</TableHead>
                    {!soloLectura && <TableHead className='w-12' />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lineas.map((l, idx) => {
                    const monto = round2(Number(l.cantidad) * Number(l.precioUnitario))
                    return (
                      <TableRow key={idx}>
                        <TableCell>
                          <Combobox
                            value={l.articuloId ? String(l.articuloId) : ''}
                            onChange={(v) => setLinea(idx, { articuloId: Number(v) })}
                            placeholder='Seleccionar servicio...'
                            searchPlaceholder='Buscar servicio...'
                            options={articulos.map((a) => ({ value: String(a.id), label: `${a.codigo} — ${a.descripcion}` }))}
                            disabled={soloLectura}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type='number' step='0.001' min='0' className='w-24'
                            value={l.cantidad}
                            onChange={(e) => setLinea(idx, { cantidad: e.target.value })}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type='number' step='0.01' min='0' className='w-28'
                            value={l.precioUnitario}
                            onChange={(e) => setLinea(idx, { precioUnitario: e.target.value })}
                          />
                        </TableCell>
                        <TableCell className='text-center'>
                          <Checkbox checked={l.exento} onCheckedChange={(v) => setLinea(idx, { exento: v === true })} disabled={soloLectura} />
                        </TableCell>
                        <TableCell className='text-right tabular-nums'>{formatMonto(monto)}</TableCell>
                        {!soloLectura && (
                          <TableCell className='text-right'>
                            <Button
                              type='button' variant='ghost' size='icon' className='h-8 w-8'
                              onClick={() => quitarLinea(idx)}
                              disabled={lineas.length <= 1}
                            >
                              <Icons.trash className='h-4 w-4' />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
            {errors.lineas && <p className='text-xs text-destructive'>{errors.lineas}</p>}
            {!soloLectura && (
              <Button type='button' variant='outline' size='sm' onClick={agregarLinea}>
                <Icons.add className='mr-1 h-4 w-4' /> Agregar línea
              </Button>
            )}
            <div className='flex justify-end text-sm font-medium'>
              Total: {formatMonto(totalProforma)}
            </div>
          </CardContent>
        </Card>
      </fieldset>

      {!soloLectura && (
        <div className='flex justify-end gap-2'>
          <Button type='button' variant='outline' onClick={() => router.push('/dashboard/productores/proformas')} disabled={isPending}>
            Cancelar
          </Button>
          <Button type='button' onClick={handleSubmit} isLoading={isPending}>
            <Icons.check className='mr-1 h-4 w-4' /> {isEdit ? 'Guardar' : 'Crear Proforma'}
          </Button>
        </div>
      )}

      {isEdit && proforma && puedeEscribir && (estado === 'BORRADOR' || estado === 'ENVIADA_VALIDACION' || estado === 'RECHAZADA') && (
        <>
          <div className='flex flex-wrap justify-between gap-2'>
            <Button type='button' variant='destructive' onClick={() => setAnularOpen(true)} disabled={!puedeAnular}>
              <Icons.trash className='mr-1 h-4 w-4' /> Anular
            </Button>
            <div className='flex gap-2'>
              {estado === 'ENVIADA_VALIDACION' && (
                <Button type='button' variant='destructive' onClick={() => setRechazarOpen(true)} disabled={!puedeRechazar}>
                  <Icons.close className='mr-1 h-4 w-4' /> Rechazar
                </Button>
              )}
              {(estado === 'BORRADOR' || estado === 'RECHAZADA') && (
                <Button type='button' onClick={() => setEnviarOpen(true)} disabled={!puedeEnviarValidacion}>
                  <Icons.check className='mr-1 h-4 w-4' /> Enviar a Validación
                </Button>
              )}
            </div>
          </div>

          <AlertModal
            isOpen={anularOpen}
            onClose={() => setAnularOpen(false)}
            onConfirm={() => anularMutation.mutate()}
            loading={anularMutation.isPending}
            title='Anular Proforma a Productor'
            description='Esta Proforma quedará Anulada y no podrá reactivarse.'
          />
          <AlertModal
            isOpen={enviarOpen}
            onClose={() => setEnviarOpen(false)}
            onConfirm={() => enviarValidacionMutation.mutate()}
            loading={enviarValidacionMutation.isPending}
            title='Enviar a Validación'
            description='La cabecera y las líneas quedarán bloqueadas. Esta Proforma quedará lista para facturación.'
          />
          <AlertModal
            isOpen={rechazarOpen}
            onClose={() => setRechazarOpen(false)}
            onConfirm={() => rechazarMutation.mutate()}
            loading={rechazarMutation.isPending}
            title='Rechazar Proforma a Productor'
            description='La Proforma volverá a estado Rechazada y quedará editable para corregirla y reenviarla a validación.'
          />
        </>
      )}

      {isEdit && proforma && (
        <DocumentoPreviewDialog
          tipo='proforma-productor'
          id={proforma.data.id}
          titulo={`Proforma de Servicios ${proforma.data.numero}`}
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          controlCopia={false}
        />
      )}
    </div>
  )
}
