'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AlertModal } from '@/components/modal/alert-modal'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Icons } from '@/components/icons'
import { Badge } from '@/components/ui/badge'
import { Combobox } from '@/components/ui/combobox'
import { usePuedeEscribir } from '@/hooks/use-item-acceso'
import { createMantenedorService } from '@/features/mantenedor-simple/service'
import { MantenedorQuickCreate } from '@/components/shared/mantenedor-simple/mantenedor-quick-create'
import { MonedaQuickCreate } from '@/features/monedas/components/moneda-quick-create'
import { condicionesPagoService } from '@/features/condiciones-pago/service'
import { FECHA_REFERENCIA_LABELS } from '@/features/condiciones-pago/types'
import type { MantenedorSimple, MantenedorSimpleListResponse } from '@/features/mantenedor-simple/types'
import { movimientosService } from '@/features/materiales/movimientos/service'
import { formatFechaCorta } from '@/lib/format'
import { proformaVentaMaterialDetailOptions, proformasVentaMaterialKeys } from '../queries'
import { proformasVentaMaterialService } from '../service'
import type { ProformaMaterialCreateInput, ProformaMaterialUpdateInput } from '../types'
import { ESTADO_PROFORMA_MATERIAL_LABELS } from '../types'

const monedasService = createMantenedorService('monedas')
const formasPagoService = createMantenedorService('formas-pago')

interface HeaderFields {
  movimientoId: number
  formaPagoId: number | null
  condicionPagoId: number | null
  monedaId: number
  observaciones: string
}

const HEADER_EMPTY: HeaderFields = {
  movimientoId: 0,
  formaPagoId: null,
  condicionPagoId: null,
  monedaId: 0,
  observaciones: '',
}

interface ProformaMaterialFormProps {
  proformaMaterialId?: number
}

const ITEM = 'MATERIALES_PROFORMA'

export function ProformaMaterialForm({ proformaMaterialId }: ProformaMaterialFormProps) {
  const isEdit = !!proformaMaterialId
  const router = useRouter()
  const queryClient = useQueryClient()
  const puedeEscribir = usePuedeEscribir(ITEM)

  function agregarAOpciones(queryKey: unknown[], item: MantenedorSimple) {
    queryClient.setQueryData<MantenedorSimpleListResponse>(queryKey, (old) =>
      old ? { ...old, data: [...old.data, item] } : old
    )
  }

  const [fields, setFields] = useState<HeaderFields>(HEADER_EMPTY)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [preciosPorLinea, setPreciosPorLinea] = useState<Record<number, string>>({})
  const [anularOpen, setAnularOpen] = useState(false)
  const [enviarOpen, setEnviarOpen] = useState(false)

  const { data: proforma, isLoading } = useQuery({
    ...proformaVentaMaterialDetailOptions(proformaMaterialId ?? 0),
    enabled: isEdit,
  })

  // Solo en creación: Movimientos CONFIRMADO, clase SALIDA, tipo habilitado
  // (generaProforma) y sin Proforma vigente todavía (R25).
  const { data: movimientosData } = useQuery({
    queryKey: ['movimientos-elegibles-proforma'],
    queryFn: () => movimientosService.list({ elegibleProforma: true, limit: 100 }),
    staleTime: 15_000,
    enabled: !isEdit,
  })
  const { data: condicionesPagoData } = useQuery({
    queryKey: ['condiciones-pago-options', 'VENTA'],
    queryFn: () => condicionesPagoService.list({ tipo: 'VENTA' }),
    staleTime: 60_000,
  })
  const { data: formasPagoData } = useQuery({ queryKey: ['formas-pago-options'], queryFn: () => formasPagoService.list({ limit: 200, soloActivos: true }), staleTime: 5 * 60_000 })
  const { data: monedasData } = useQuery({ queryKey: ['monedas-options'], queryFn: () => monedasService.list({ limit: 200 }), staleTime: 5 * 60_000 })

  const movimientosElegibles = movimientosData?.data ?? []
  const movimientoSeleccionado = movimientosElegibles.find((m) => m.id === fields.movimientoId)

  const condicionPagoSeleccionada = (condicionesPagoData?.data ?? []).find((c) => c.id === fields.condicionPagoId)
  const cuotasPreview = isEdit ? proforma?.data.cuotasPago ?? [] : condicionPagoSeleccionada?.cuotas ?? []

  useEffect(() => {
    if (proforma) {
      const d = proforma.data
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza el estado local del form con la respuesta del server al cargar/refrescar (mismo patrón que orden-compra-material-form.tsx)
      setFields({
        movimientoId: d.movimientoId,
        formaPagoId: d.formaPagoId,
        condicionPagoId: d.condicionPagoId,
        monedaId: d.monedaId,
        observaciones: d.observaciones ?? '',
      })
      setPreciosPorLinea(Object.fromEntries(d.lineas.map((l) => [l.id, l.precioUnitario])))
    }
  }, [proforma])

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!isEdit && !fields.movimientoId) e.movimientoId = 'El movimiento es requerido'
    if (!fields.monedaId) e.monedaId = 'La moneda es requerida'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function buildCreatePayload(): ProformaMaterialCreateInput {
    return {
      movimientoId: fields.movimientoId,
      formaPagoId: fields.formaPagoId,
      condicionPagoId: fields.condicionPagoId,
      monedaId: fields.monedaId,
      observaciones: fields.observaciones.trim() || undefined,
    }
  }

  function buildUpdatePayload(): ProformaMaterialUpdateInput {
    return {
      formaPagoId: fields.formaPagoId,
      condicionPagoId: fields.condicionPagoId,
      monedaId: fields.monedaId,
      observaciones: fields.observaciones.trim() || undefined,
    }
  }

  const createMutation = useMutation({
    mutationFn: (data: ProformaMaterialCreateInput) => proformasVentaMaterialService.create(data),
    onSuccess: (res) => {
      toast.success(`Proforma de Venta de Materiales creada — ${res.data.numero}`)
      queryClient.invalidateQueries({ queryKey: proformasVentaMaterialKeys.all })
      router.push(`/dashboard/operaciones/materiales/proformas/${res.data.id}`)
    },
    onError: (e: Error) => toast.error(e.message || 'Error al crear la Proforma de Venta'),
  })

  const updateMutation = useMutation({
    mutationFn: (data: ProformaMaterialUpdateInput) => proformasVentaMaterialService.update(proformaMaterialId!, data),
    onSuccess: () => {
      toast.success('Proforma de Venta actualizada')
      queryClient.invalidateQueries({ queryKey: proformasVentaMaterialKeys.detail(proformaMaterialId!) })
    },
    onError: (e: Error) => toast.error(e.message || 'Error al actualizar la Proforma de Venta'),
  })

  const updatePrecioMutation = useMutation({
    mutationFn: ({ lineaId, precioUnitario }: { lineaId: number; precioUnitario: number }) =>
      proformasVentaMaterialService.updateLineaPrecio(proformaMaterialId!, lineaId, { precioUnitario }),
    onSuccess: () => {
      toast.success('Precio actualizado')
      queryClient.invalidateQueries({ queryKey: proformasVentaMaterialKeys.detail(proformaMaterialId!) })
    },
    onError: (e: Error) => toast.error(e.message || 'Error al actualizar el precio'),
  })

  const enviarValidacionMutation = useMutation({
    mutationFn: () => proformasVentaMaterialService.enviarValidacion(proformaMaterialId!),
    onSuccess: () => {
      toast.success('Proforma enviada a validación')
      setEnviarOpen(false)
      queryClient.invalidateQueries({ queryKey: proformasVentaMaterialKeys.detail(proformaMaterialId!) })
    },
    onError: (e: Error) => {
      toast.error(e.message || 'Error al enviar a validación')
      setEnviarOpen(false)
    },
  })

  const anularMutation = useMutation({
    mutationFn: () => proformasVentaMaterialService.anular(proformaMaterialId!),
    onSuccess: () => {
      toast.success('Proforma anulada')
      setAnularOpen(false)
      queryClient.invalidateQueries({ queryKey: proformasVentaMaterialKeys.all })
      queryClient.invalidateQueries({ queryKey: proformasVentaMaterialKeys.detail(proformaMaterialId!) })
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
    if (isEdit) updateMutation.mutate(buildUpdatePayload())
    else createMutation.mutate(buildCreatePayload())
  }

  function handleGuardarPrecio(lineaId: number) {
    const valor = Number(preciosPorLinea[lineaId] ?? 0)
    if (valor < 0) {
      toast.error('El precio no puede ser negativo')
      return
    }
    updatePrecioMutation.mutate({ lineaId, precioUnitario: valor })
  }

  if (isEdit && isLoading) {
    return <p className='text-sm text-muted-foreground'>Cargando…</p>
  }

  const isPending = createMutation.isPending || updateMutation.isPending
  const estado = proforma?.data.estado
  // R25: BORRADOR es el único estado editable — ENVIADA_VALIDACION bloquea
  // cabecera, líneas y precios (no hay estado intermedio como EMITIDA en la OC).
  const soloLectura = !puedeEscribir || (isEdit && estado !== 'BORRADOR')
  const puedeAnular = puedeEscribir && (estado === 'BORRADOR' || estado === 'ENVIADA_VALIDACION')
  const todasConPrecio = (proforma?.data.lineas ?? []).every((l) => Number(l.precioUnitario) > 0)
  const puedeEnviarValidacion = puedeEscribir && estado === 'BORRADOR' && todasConPrecio

  return (
    <div className='space-y-6'>
      {isEdit && proforma && (
        <div className='flex items-center gap-2'>
          <Badge variant={estado === 'BORRADOR' ? 'secondary' : estado === 'ENVIADA_VALIDACION' ? 'default' : estado === 'ANULADA' ? 'destructive' : 'outline'}>
            {ESTADO_PROFORMA_MATERIAL_LABELS[proforma.data.estado]}
          </Badge>
          {soloLectura && (
            <span className='text-xs text-muted-foreground'>
              {!puedeEscribir
                ? 'Solo lectura — sin permiso de edición'
                : estado === 'ENVIADA_VALIDACION'
                  ? 'Enviada a validación — ya no se puede editar. Queda a la espera de facturación.'
                  : 'Anulada — no editable'}
            </span>
          )}
        </div>
      )}

      <fieldset disabled={soloLectura} className='m-0 space-y-6 border-0 p-0'>
        <Card>
          <CardHeader>
            <CardTitle>{isEdit ? `Proforma de Venta ${proforma?.data.numero}` : 'Nueva Proforma de Venta de Materiales'}</CardTitle>
          </CardHeader>
          <CardContent className='space-y-4'>
            {!isEdit && (
              <div className='space-y-1.5'>
                <Label>Movimiento de Venta <span className='text-destructive'>*</span></Label>
                <Combobox
                  value={fields.movimientoId ? String(fields.movimientoId) : ''}
                  onChange={(v) => setFields((f) => ({ ...f, movimientoId: Number(v) }))}
                  placeholder='Seleccionar movimiento...'
                  searchPlaceholder='Buscar movimiento...'
                  options={movimientosElegibles.map((m) => ({
                    value: String(m.id),
                    label: `#${m.id} — ${m.entidad?.descripcion ?? 'Sin cliente'} — ${formatFechaCorta(m.fechaMovimiento)}`,
                  }))}
                  disabled={soloLectura}
                />
                {errors.movimientoId && <p className='text-xs text-destructive'>{errors.movimientoId}</p>}
                <p className='text-xs text-muted-foreground'>
                  Solo se listan Movimientos Confirmados de un Tipo habilitado para generar Proforma y que aún no tengan una vigente.
                </p>
                {movimientoSeleccionado && (
                  <div className='mt-2 rounded-md border p-3 text-sm'>
                    <p className='font-medium'>{movimientoSeleccionado.entidad?.descripcion} — {movimientoSeleccionado.entidad?.razonSocial}</p>
                    <p className='text-xs text-muted-foreground'>
                      {movimientoSeleccionado.tipoMovimiento.descripcion} · Bodega {movimientoSeleccionado.bodegaOrigen?.descripcion ?? '—'} · {formatFechaCorta(movimientoSeleccionado.fechaMovimiento)}
                    </p>
                    <ul className='mt-2 list-inside list-disc text-xs text-muted-foreground'>
                      {movimientoSeleccionado.detalle.map((d) => (
                        <li key={d.articuloId}>{d.articulo.codigo} — {d.articulo.descripcion}: {d.cantidad}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {isEdit && proforma && (
              <div className='rounded-md border p-3 text-sm'>
                <p className='font-medium'>{proforma.data.entidad.descripcion} — {proforma.data.entidad.razonSocial}</p>
                <p className='text-xs text-muted-foreground'>
                  Movimiento #{proforma.data.movimiento.id} · {proforma.data.movimiento.tipoMovimiento.descripcion} · Bodega {proforma.data.movimiento.bodegaOrigen?.descripcion ?? '—'} · {formatFechaCorta(proforma.data.movimiento.fechaMovimiento)}
                  {proforma.data.movimiento.guiaReferencia ? ` · Guía ${proforma.data.movimiento.guiaReferencia}` : ''}
                </p>
              </div>
            )}

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
                <p className='text-xs text-muted-foreground'>Solo se aceptan condiciones con cuotas 100% porcentaje.</p>
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
              </div>
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
      </fieldset>

      {!soloLectura && (
        <div className='flex justify-end gap-2'>
          <Button type='button' variant='outline' onClick={() => router.push('/dashboard/operaciones/materiales/proformas')} disabled={isPending}>
            Cancelar
          </Button>
          <Button type='button' onClick={handleSubmit} isLoading={isPending}>
            <Icons.check className='mr-1 h-4 w-4' /> {isEdit ? 'Guardar cabecera' : 'Crear Proforma'}
          </Button>
        </div>
      )}

      {isEdit && proforma && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Líneas</CardTitle>
            </CardHeader>
            <CardContent>
              <p className='mb-3 text-xs text-muted-foreground'>
                Artículo y cantidad copiados desde el Movimiento de origen — solo el precio de venta es editable.
              </p>
              <div className='overflow-x-auto rounded-md border'>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Artículo</TableHead>
                      <TableHead>Cantidad</TableHead>
                      <TableHead>Precio Unitario</TableHead>
                      <TableHead>Monto</TableHead>
                      {estado === 'BORRADOR' && puedeEscribir && <TableHead className='w-24 text-right'>Acción</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {proforma.data.lineas.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className='font-medium whitespace-nowrap'>{l.articulo.codigo} — {l.articulo.descripcion}</TableCell>
                        <TableCell className='whitespace-nowrap text-muted-foreground'>{l.cantidad} {l.articulo.unidad.codigo}</TableCell>
                        <TableCell className='whitespace-nowrap'>
                          {estado === 'BORRADOR' && puedeEscribir ? (
                            <Input
                              type='number' step='0.01' className='w-28'
                              value={preciosPorLinea[l.id] ?? ''}
                              onChange={(e) => setPreciosPorLinea((p) => ({ ...p, [l.id]: e.target.value }))}
                            />
                          ) : (
                            <span className='text-muted-foreground'>${l.precioUnitario}</span>
                          )}
                        </TableCell>
                        <TableCell className='whitespace-nowrap text-muted-foreground'>${l.monto}</TableCell>
                        {estado === 'BORRADOR' && puedeEscribir && (
                          <TableCell className='text-right'>
                            <Button
                              type='button' variant='ghost' size='icon' className='h-8 w-8'
                              onClick={() => handleGuardarPrecio(l.id)}
                              disabled={updatePrecioMutation.isPending}
                            >
                              <Icons.check className='h-4 w-4' />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {estado === 'BORRADOR' && !todasConPrecio && (
                <p className='mt-2 text-xs text-muted-foreground'>Todas las líneas deben tener un precio mayor a 0 antes de enviar a validación.</p>
              )}
            </CardContent>
          </Card>

          {puedeEscribir && (estado === 'BORRADOR' || estado === 'ENVIADA_VALIDACION') && (
            <div className='flex flex-wrap justify-between gap-2'>
              <Button type='button' variant='destructive' onClick={() => setAnularOpen(true)} disabled={!puedeAnular}>
                <Icons.trash className='mr-1 h-4 w-4' /> Anular
              </Button>
              {estado === 'BORRADOR' && (
                <Button type='button' onClick={() => setEnviarOpen(true)} disabled={!puedeEnviarValidacion}>
                  <Icons.check className='mr-1 h-4 w-4' /> Enviar a Validación
                </Button>
              )}
            </div>
          )}

          <AlertModal
            isOpen={anularOpen}
            onClose={() => setAnularOpen(false)}
            onConfirm={() => anularMutation.mutate()}
            loading={anularMutation.isPending}
            title='Anular Proforma de Venta'
            description='Esta Proforma quedará Anulada y no podrá reactivarse. El Movimiento de origen queda libre para una nueva Proforma.'
          />
          <AlertModal
            isOpen={enviarOpen}
            onClose={() => setEnviarOpen(false)}
            onConfirm={() => enviarValidacionMutation.mutate()}
            loading={enviarValidacionMutation.isPending}
            title='Enviar a Validación'
            description='La cabecera, las líneas y los precios quedarán bloqueados. Esta Proforma quedará lista para facturación.'
          />
        </>
      )}
    </div>
  )
}
