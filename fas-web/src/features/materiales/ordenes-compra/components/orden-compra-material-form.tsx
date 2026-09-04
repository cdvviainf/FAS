'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
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
import { entidadesService } from '@/features/entidades/service'
import { articulosService } from '@/features/materiales/articulos/service'
import { condicionesPagoService } from '@/features/condiciones-pago/service'
import { FECHA_REFERENCIA_LABELS } from '@/features/condiciones-pago/types'
import type { MantenedorSimple, MantenedorSimpleListResponse } from '@/features/mantenedor-simple/types'
import { ESTADO_MOVIMIENTO_LABELS } from '@/features/materiales/movimientos/types'
import { ordenCompraMaterialDetailOptions, ordenesCompraMaterialKeys } from '../queries'
import { ordenesCompraMaterialService } from '../service'
import type {
  OrdenCompraMaterialCreateInput,
  OrdenCompraMaterialLineaInput,
  OrdenCompraMaterialLineaItem,
} from '../types'
import { ESTADO_OCM_LABELS } from '../types'

const monedasService = createMantenedorService('monedas')
const formasPagoService = createMantenedorService('formas-pago')

interface HeaderFields {
  entidadProveedorId: number
  fecha: string
  formaPagoId: number | null
  condicionPagoId: number | null
  monedaId: number
  observaciones: string
}

const HEADER_EMPTY: HeaderFields = {
  entidadProveedorId: 0,
  fecha: new Date().toISOString().slice(0, 10),
  formaPagoId: null,
  condicionPagoId: null,
  monedaId: 0,
  observaciones: '',
}

const LINEA_EMPTY: OrdenCompraMaterialLineaInput = {
  articuloId: 0,
  cantidad: 0,
  precioUnitario: 0,
}

interface OrdenCompraMaterialFormProps {
  ordenCompraMaterialId?: number
}

const ITEM = 'MATERIALES_OC'
// "Registrar ingreso" crea/edita un Movimiento (fas-api movimientos.routes.ts
// exige TOTAL en OPER_MATERIALES para crear cabecera, vincular y agregar
// líneas) — MATERIALES_OC por sí solo no alcanza para esa acción (OCM-QA-005).
const ITEM_MOVIMIENTOS = 'OPER_MATERIALES'

export function OrdenCompraMaterialForm({ ordenCompraMaterialId }: OrdenCompraMaterialFormProps) {
  const isEdit = !!ordenCompraMaterialId
  const router = useRouter()
  const queryClient = useQueryClient()
  const puedeEscribir = usePuedeEscribir(ITEM)
  const puedeEscribirMovimientos = usePuedeEscribir(ITEM_MOVIMIENTOS)

  // Los selectores de Forma de Pago/Moneda usan una queryKey ad-hoc (no la de
  // createMantenedorQueries), así que el quick-create no la invalida solo —
  // agregamos el registro recién creado directo al cache para que aparezca
  // sin esperar un refetch.
  function agregarAOpciones(queryKey: unknown[], item: MantenedorSimple) {
    queryClient.setQueryData<MantenedorSimpleListResponse>(queryKey, (old) =>
      old ? { ...old, data: [...old.data, item] } : old
    )
  }

  const [fields, setFields] = useState<HeaderFields>(HEADER_EMPTY)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [linea, setLinea] = useState<OrdenCompraMaterialLineaInput>(LINEA_EMPTY)
  const [lineaErrors, setLineaErrors] = useState<Record<string, string>>({})
  const [editingLineaId, setEditingLineaId] = useState<number | null>(null)
  const [deleteLineaId, setDeleteLineaId] = useState<number | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [emitirOpen, setEmitirOpen] = useState(false)

  const { data: ordenCompra, isLoading } = useQuery({
    ...ordenCompraMaterialDetailOptions(ordenCompraMaterialId ?? 0),
    enabled: isEdit,
  })

  const { data: proveedoresData } = useQuery({
    queryKey: ['entidades-proveedores-options'],
    queryFn: () => entidadesService.list({ tipo: 'PROVEEDOR', limit: 500, activo: true }),
    staleTime: 60_000,
  })
  const { data: condicionesPagoData } = useQuery({
    queryKey: ['condiciones-pago-options', 'COMPRA'],
    queryFn: () => condicionesPagoService.list({ tipo: 'COMPRA' }),
    staleTime: 60_000,
  })
  const { data: formasPagoData } = useQuery({ queryKey: ['formas-pago-options'], queryFn: () => formasPagoService.list({ limit: 200, soloActivos: true }), staleTime: 5 * 60_000 })
  const { data: monedasData } = useQuery({ queryKey: ['monedas-options'], queryFn: () => monedasService.list({ limit: 200 }), staleTime: 5 * 60_000 })
  const { data: articulosData } = useQuery({ queryKey: ['articulos-options-ocm'], queryFn: () => articulosService.list({ limit: 500, activo: true }), staleTime: 60_000 })

  const proveedores = proveedoresData?.data ?? []
  const articulos = articulosData?.data ?? []

  // Cuotas que se derivarán automáticamente al guardar (según Condición de
  // Pago seleccionada) — solo lectura, no se cargan manualmente (mismo
  // patrón que orden-compra-form.tsx de fruta).
  const condicionPagoSeleccionada = (condicionesPagoData?.data ?? []).find((c) => c.id === fields.condicionPagoId)
  const cuotasPreview = isEdit ? ordenCompra?.data.cuotasPago ?? [] : condicionPagoSeleccionada?.cuotas ?? []

  useEffect(() => {
    if (ordenCompra) {
      const d = ordenCompra.data
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza el estado local del form con la respuesta del server al cargar/refrescar (mismo patrón que orden-compra-form.tsx / movimiento-form.tsx)
      setFields({
        entidadProveedorId: d.entidadProveedorId,
        fecha: d.fecha.slice(0, 10),
        formaPagoId: d.formaPagoId,
        condicionPagoId: d.condicionPagoId,
        monedaId: d.monedaId,
        observaciones: d.observaciones ?? '',
      })
    }
  }, [ordenCompra])

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!fields.entidadProveedorId) e.entidadProveedorId = 'El proveedor es requerido'
    if (!fields.monedaId) e.monedaId = 'La moneda es requerida'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function buildPayload(): OrdenCompraMaterialCreateInput {
    return {
      entidadProveedorId: fields.entidadProveedorId,
      fecha: fields.fecha,
      formaPagoId: fields.formaPagoId,
      condicionPagoId: fields.condicionPagoId,
      monedaId: fields.monedaId,
      observaciones: fields.observaciones.trim() || undefined,
    }
  }

  const createMutation = useMutation({
    mutationFn: (data: OrdenCompraMaterialCreateInput) => ordenesCompraMaterialService.create(data),
    onSuccess: (res) => {
      toast.success(`Orden de Compra de Materiales creada — ${res.data.numero}`)
      queryClient.invalidateQueries({ queryKey: ordenesCompraMaterialKeys.all })
      router.push(`/dashboard/operaciones/materiales/ordenes-compra/${res.data.id}`)
    },
    onError: (e: Error) => toast.error(e.message || 'Error al crear la Orden de Compra'),
  })

  const updateMutation = useMutation({
    mutationFn: (data: OrdenCompraMaterialCreateInput) => ordenesCompraMaterialService.update(ordenCompraMaterialId!, data),
    onSuccess: () => {
      toast.success('Orden de Compra actualizada')
      queryClient.invalidateQueries({ queryKey: ordenesCompraMaterialKeys.all })
      queryClient.invalidateQueries({ queryKey: ordenesCompraMaterialKeys.detail(ordenCompraMaterialId!) })
    },
    onError: (e: Error) => toast.error(e.message || 'Error al actualizar la Orden de Compra'),
  })

  const deleteMutation = useMutation({
    mutationFn: () => ordenesCompraMaterialService.remove(ordenCompraMaterialId!),
    onSuccess: () => {
      toast.success('Orden de Compra eliminada')
      queryClient.invalidateQueries({ queryKey: ordenesCompraMaterialKeys.all })
      router.push('/dashboard/operaciones/materiales/ordenes-compra')
    },
    onError: (e: Error) => {
      toast.error(e.message || 'Error al eliminar la Orden de Compra')
      setDeleteOpen(false)
    },
  })

  const emitirMutation = useMutation({
    mutationFn: () => ordenesCompraMaterialService.emitir(ordenCompraMaterialId!),
    onSuccess: () => {
      toast.success('Orden de Compra emitida')
      setEmitirOpen(false)
      queryClient.invalidateQueries({ queryKey: ordenesCompraMaterialKeys.all })
      queryClient.invalidateQueries({ queryKey: ordenesCompraMaterialKeys.detail(ordenCompraMaterialId!) })
    },
    onError: (e: Error) => {
      toast.error(e.message || 'Error al emitir la Orden de Compra')
      setEmitirOpen(false)
    },
  })

  const addLineaMutation = useMutation({
    mutationFn: (data: OrdenCompraMaterialLineaInput) => ordenesCompraMaterialService.addLinea(ordenCompraMaterialId!, data),
    onSuccess: () => {
      toast.success('Línea agregada')
      setLinea(LINEA_EMPTY)
      setLineaErrors({})
      queryClient.invalidateQueries({ queryKey: ordenesCompraMaterialKeys.detail(ordenCompraMaterialId!) })
    },
    onError: (e: Error) => toast.error(e.message || 'Error al agregar la línea'),
  })

  const updateLineaMutation = useMutation({
    mutationFn: (data: OrdenCompraMaterialLineaInput) => ordenesCompraMaterialService.updateLinea(ordenCompraMaterialId!, editingLineaId!, data),
    onSuccess: () => {
      toast.success('Línea actualizada')
      setLinea(LINEA_EMPTY)
      setLineaErrors({})
      setEditingLineaId(null)
      queryClient.invalidateQueries({ queryKey: ordenesCompraMaterialKeys.detail(ordenCompraMaterialId!) })
    },
    onError: (e: Error) => toast.error(e.message || 'Error al actualizar la línea'),
  })

  const removeLineaMutation = useMutation({
    mutationFn: (lineaId: number) => ordenesCompraMaterialService.removeLinea(ordenCompraMaterialId!, lineaId),
    onSuccess: () => {
      toast.success('Línea eliminada')
      setDeleteLineaId(null)
      queryClient.invalidateQueries({ queryKey: ordenesCompraMaterialKeys.detail(ordenCompraMaterialId!) })
    },
    onError: (e: Error) => toast.error(e.message || 'Error al eliminar la línea'),
  })

  function handleSubmit() {
    if (!validate()) {
      toast.error('Hay campos por corregir')
      return
    }
    const payload = buildPayload()
    if (isEdit) updateMutation.mutate(payload)
    else createMutation.mutate(payload)
  }

  function validarLinea(): boolean {
    const e: Record<string, string> = {}
    if (!linea.articuloId) e.articuloId = 'El artículo es requerido'
    if (!linea.cantidad || linea.cantidad <= 0) e.cantidad = 'Debe ser mayor a 0'
    if (linea.precioUnitario < 0) e.precioUnitario = 'No puede ser negativo'
    setLineaErrors(e)
    return Object.keys(e).length === 0
  }

  function handleGuardarLinea() {
    if (!validarLinea()) return
    if (editingLineaId) updateLineaMutation.mutate(linea)
    else addLineaMutation.mutate(linea)
  }

  function handleEditarLinea(l: OrdenCompraMaterialLineaItem) {
    setEditingLineaId(l.id)
    setLinea({
      articuloId: l.articuloId,
      cantidad: Number(l.cantidad),
      precioUnitario: Number(l.precioUnitario),
    })
    setLineaErrors({})
  }

  function handleCancelarEdicionLinea() {
    setEditingLineaId(null)
    setLinea(LINEA_EMPTY)
    setLineaErrors({})
  }

  if (isEdit && isLoading) {
    return <p className='text-sm text-muted-foreground'>Cargando…</p>
  }

  const isPending = createMutation.isPending || updateMutation.isPending
  const estado = ordenCompra?.data.estado
  // R20 (materiales.md): a diferencia de la OC de fruta, EMITIDA ya bloquea
  // toda edición de cabecera y líneas — solo BORRADOR es editable.
  const soloLectura = !puedeEscribir || (isEdit && estado !== 'BORRADOR')
  const lineaMutationPending = addLineaMutation.isPending || updateLineaMutation.isPending
  const movimientos = ordenCompra?.data.movimientos ?? []
  const tieneMovimientoActivo = movimientos.length > 0
  const puedeEliminar = puedeEscribir && estado !== 'RECEPCIONADA' && !tieneMovimientoActivo
  const puedeEmitir = puedeEscribir && estado === 'BORRADOR' && (ordenCompra?.data.lineas.length ?? 0) > 0
  const puedeRegistrarIngreso = puedeEscribir && puedeEscribirMovimientos && estado === 'EMITIDA' && !tieneMovimientoActivo

  return (
    <div className='space-y-6'>
      {isEdit && ordenCompra && (
        <div className='flex items-center gap-2'>
          <Badge variant={estado === 'BORRADOR' ? 'secondary' : estado === 'EMITIDA' ? 'default' : 'outline'}>
            {ESTADO_OCM_LABELS[ordenCompra.data.estado]}
          </Badge>
          {soloLectura && (
            <span className='text-xs text-muted-foreground'>
              {!puedeEscribir
                ? 'Solo lectura — sin permiso de edición'
                : estado === 'EMITIDA'
                  ? 'Emitida — la cabecera y las líneas ya no se pueden editar. Para corregirla, elimínala (si no tiene un Movimiento activo) y crea una nueva.'
                  : 'Recepcionada — no editable'}
            </span>
          )}
        </div>
      )}

      <fieldset disabled={soloLectura} className='m-0 space-y-6 border-0 p-0'>
        <Card>
          <CardHeader>
            <CardTitle>{isEdit ? `Orden de Compra de Materiales ${ordenCompra?.data.numero}` : 'Nueva Orden de Compra de Materiales'}</CardTitle>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='grid gap-4 sm:grid-cols-2'>
              <div className='space-y-1.5'>
                <Label>Proveedor <span className='text-destructive'>*</span></Label>
                <Combobox
                  value={fields.entidadProveedorId ? String(fields.entidadProveedorId) : ''}
                  onChange={(v) => setFields((f) => ({ ...f, entidadProveedorId: Number(v) }))}
                  placeholder='Seleccionar proveedor...'
                  searchPlaceholder='Buscar proveedor...'
                  options={proveedores.map((p) => ({ value: String(p.id), label: `${p.descripcion} — ${p.razonSocial}` }))}
                  disabled={soloLectura}
                />
                {errors.entidadProveedorId && <p className='text-xs text-destructive'>{errors.entidadProveedorId}</p>}
              </div>
              <div className='space-y-1.5'>
                <Label>Fecha</Label>
                <Input type='date' value={fields.fecha} onChange={(e) => setFields((f) => ({ ...f, fecha: e.target.value }))} />
              </div>
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
          <Button type='button' variant='outline' onClick={() => router.push('/dashboard/operaciones/materiales/ordenes-compra')} disabled={isPending}>
            Cancelar
          </Button>
          <Button type='button' onClick={handleSubmit} isLoading={isPending}>
            <Icons.check className='mr-1 h-4 w-4' /> {isEdit ? 'Guardar cabecera' : 'Crear Orden de Compra'}
          </Button>
        </div>
      )}

      {isEdit && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Líneas</CardTitle>
            </CardHeader>
            <CardContent className='space-y-4'>
              <fieldset disabled={soloLectura} className='m-0 space-y-4 border-0 p-0'>
                <div className='grid gap-3 sm:grid-cols-2 md:grid-cols-4'>
                  <div className='space-y-1.5 md:col-span-2'>
                    <Label>Artículo <span className='text-destructive'>*</span></Label>
                    <Select value={linea.articuloId ? String(linea.articuloId) : ''} onValueChange={(v) => setLinea((l) => ({ ...l, articuloId: Number(v) }))}>
                      <SelectTrigger><SelectValue placeholder='Seleccionar artículo...' /></SelectTrigger>
                      <SelectContent>
                        {articulos.map((a) => (
                          <SelectItem key={a.id} value={String(a.id)}>{a.codigo} — {a.descripcion}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {lineaErrors.articuloId && <p className='text-xs text-destructive'>{lineaErrors.articuloId}</p>}
                  </div>
                  <div className='space-y-1.5'>
                    <Label>Cantidad <span className='text-destructive'>*</span></Label>
                    <Input
                      type='number' step='0.001'
                      value={linea.cantidad || ''}
                      onChange={(e) => setLinea((l) => ({ ...l, cantidad: Number(e.target.value) }))}
                    />
                    {lineaErrors.cantidad && <p className='text-xs text-destructive'>{lineaErrors.cantidad}</p>}
                  </div>
                  <div className='space-y-1.5'>
                    <Label>Precio Unitario</Label>
                    <Input
                      type='number' step='0.01'
                      value={linea.precioUnitario || ''}
                      onChange={(e) => setLinea((l) => ({ ...l, precioUnitario: Number(e.target.value) }))}
                    />
                    {lineaErrors.precioUnitario && <p className='text-xs text-destructive'>{lineaErrors.precioUnitario}</p>}
                  </div>
                </div>

                {linea.cantidad > 0 && (
                  <p className='text-right text-sm text-muted-foreground'>
                    Monto: {linea.cantidad} × ${linea.precioUnitario || 0} = ${(linea.cantidad * linea.precioUnitario).toFixed(2)}
                  </p>
                )}

                <div className='flex justify-end gap-2'>
                  {editingLineaId && (
                    <Button type='button' variant='outline' onClick={handleCancelarEdicionLinea} disabled={lineaMutationPending}>
                      Cancelar edición
                    </Button>
                  )}
                  <Button type='button' onClick={handleGuardarLinea} isLoading={lineaMutationPending}>
                    {editingLineaId ? <><Icons.check className='mr-1 h-4 w-4' /> Guardar cambios de línea</> : <><Icons.add className='mr-1 h-4 w-4' /> Agregar línea</>}
                  </Button>
                </div>
              </fieldset>

              {(ordenCompra?.data.lineas.length ?? 0) > 0 && (
                <>
                  <Separator />
                  <div className='overflow-x-auto rounded-md border'>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Artículo</TableHead>
                          <TableHead>Cantidad</TableHead>
                          <TableHead>Precio Unitario</TableHead>
                          <TableHead>Monto</TableHead>
                          {!soloLectura && <TableHead className='w-20 text-right'>Acciones</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ordenCompra!.data.lineas.map((l) => (
                          <TableRow key={l.id}>
                            <TableCell className='font-medium whitespace-nowrap'>{l.articulo.codigo} — {l.articulo.descripcion}</TableCell>
                            <TableCell className='whitespace-nowrap text-muted-foreground'>{l.cantidad} {l.articulo.unidad.codigo}</TableCell>
                            <TableCell className='whitespace-nowrap text-muted-foreground'>${l.precioUnitario}</TableCell>
                            <TableCell className='whitespace-nowrap text-muted-foreground'>${l.monto}</TableCell>
                            {!soloLectura && (
                              <TableCell className='text-right'>
                                <div className='flex justify-end gap-1'>
                                  <Button type='button' variant='ghost' size='icon' className='h-8 w-8' onClick={() => handleEditarLinea(l)}>
                                    <Icons.edit className='h-4 w-4' />
                                  </Button>
                                  <Button type='button' variant='ghost' size='icon' className='h-8 w-8' onClick={() => setDeleteLineaId(l.id)}>
                                    <Icons.trash className='h-4 w-4' />
                                  </Button>
                                </div>
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}

              <AlertModal
                isOpen={deleteLineaId != null}
                onClose={() => setDeleteLineaId(null)}
                onConfirm={() => deleteLineaId && removeLineaMutation.mutate(deleteLineaId)}
                loading={removeLineaMutation.isPending}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Movimiento(s) vinculado(s)</CardTitle>
            </CardHeader>
            <CardContent>
              {movimientos.length === 0 ? (
                <p className='text-sm text-muted-foreground'>
                  {estado === 'BORRADOR'
                    ? 'Aún no hay Movimiento de ingreso — primero emite la Orden de Compra.'
                    : 'Aún no se ha registrado un Movimiento de ingreso a stock.'}
                </p>
              ) : (
                <div className='overflow-x-auto rounded-md border'>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Movimiento</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className='w-24 text-right'>Acción</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {movimientos.map((m) => (
                        <TableRow key={m.id}>
                          <TableCell className='font-medium'>#{m.id}</TableCell>
                          <TableCell className='text-muted-foreground'>{new Date(m.fechaMovimiento).toLocaleDateString('es-CL')}</TableCell>
                          <TableCell>
                            <Badge variant={m.estado === 'CONFIRMADO' ? 'default' : 'secondary'}>{ESTADO_MOVIMIENTO_LABELS[m.estado]}</Badge>
                          </TableCell>
                          <TableCell className='text-right'>
                            <Button asChild type='button' variant='ghost' size='sm'>
                              <Link href={`/dashboard/operaciones/movimientos/${m.id}`}>
                                Ver <Icons.arrowRight className='ml-1 h-3.5 w-3.5' />
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {puedeEscribir && (estado === 'BORRADOR' || estado === 'EMITIDA') && (
            <div className='flex flex-wrap justify-between gap-2'>
              <Button
                type='button'
                variant='destructive'
                onClick={() => setDeleteOpen(true)}
                disabled={!puedeEliminar}
                title={!puedeEliminar ? 'Tiene un Movimiento activo vinculado — elimínalo primero' : undefined}
              >
                <Icons.trash className='mr-1 h-4 w-4' /> Eliminar
              </Button>
              <div className='flex gap-2'>
                {estado === 'BORRADOR' && (
                  <Button type='button' onClick={() => setEmitirOpen(true)} disabled={!puedeEmitir}>
                    <Icons.check className='mr-1 h-4 w-4' /> Emitir OC
                  </Button>
                )}
                {estado === 'EMITIDA' && puedeRegistrarIngreso && (
                  <Button asChild type='button'>
                    <Link href={`/dashboard/operaciones/movimientos/nuevo?ordenCompraMaterialId=${ordenCompraMaterialId}`}>
                      <Icons.add className='mr-1 h-4 w-4' /> Registrar ingreso
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          )}

          <AlertModal
            isOpen={deleteOpen}
            onClose={() => setDeleteOpen(false)}
            onConfirm={() => deleteMutation.mutate()}
            loading={deleteMutation.isPending}
          />
          <AlertModal
            isOpen={emitirOpen}
            onClose={() => setEmitirOpen(false)}
            onConfirm={() => emitirMutation.mutate()}
            loading={emitirMutation.isPending}
            title='Emitir Orden de Compra'
            description='Al emitir, la cabecera y las líneas quedan bloqueadas — para corregirlas deberás eliminar esta OC (si no tiene un Movimiento activo) y crear una nueva. Esta acción formaliza el compromiso con el proveedor.'
          />
        </>
      )}
    </div>
  )
}
