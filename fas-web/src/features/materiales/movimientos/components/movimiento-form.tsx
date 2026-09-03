'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
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
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AlertModal } from '@/components/modal/alert-modal'
import { Icons } from '@/components/icons'
import { usePuedeEscribir } from '@/hooks/use-item-acceso'
import { entidadesService } from '@/features/entidades/service'
import { createMantenedorService } from '@/features/mantenedor-simple/service'
import { articulosService } from '../../articulos/service'
import { tiposMovimientoService } from '../../tipos-movimiento/service'
import { ordenesCompraMaterialService } from '../../ordenes-compra/service'
import { movimientosService } from '../service'
import { movimientosKeys, movimientoDetailOptions } from '../queries'
import { ESTADO_MOVIMIENTO_LABELS } from '../types'
import type { MovimientoDetalleInput, MovimientoDetalleItem, MovimientoUpdateInput } from '../types'

const bodegasService = createMantenedorService('bodegas')

const ITEM = 'OPER_MATERIALES'

function toIsoLocal(dateOnly: boolean, value: string): string {
  if (dateOnly) return new Date(`${value}T00:00:00`).toISOString()
  return new Date(value).toISOString()
}

interface HeaderFields {
  entidadId: number | null
  fechaMovimiento: string
  bodegaOrigenId: number | null
  bodegaDestinoId: number | null
  guiaReferencia: string
  transporteEntidadId: number | null
  choferRut: string
  choferNombre: string
  placaCamion: string
  placaRemolque: string
  horaSalida: string
  horaEstimadaLlegada: string
}

const HEADER_EMPTY: HeaderFields = {
  entidadId: null,
  fechaMovimiento: new Date().toISOString().slice(0, 10),
  bodegaOrigenId: null,
  bodegaDestinoId: null,
  guiaReferencia: '',
  transporteEntidadId: null,
  choferRut: '',
  choferNombre: '',
  placaCamion: '',
  placaRemolque: '',
  horaSalida: '',
  horaEstimadaLlegada: '',
}

const LINEA_EMPTY: MovimientoDetalleInput = { articuloId: 0, cantidad: 0, precioUnitario: null }

interface MovimientoFormProps {
  movimientoId?: number
}

export function MovimientoForm({ movimientoId }: MovimientoFormProps) {
  const isEdit = !!movimientoId
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const puedeEscribir = usePuedeEscribir(ITEM)

  const [tipoMovimientoId, setTipoMovimientoId] = useState<number | null>(null)
  const [fechaCrear, setFechaCrear] = useState(() => new Date().toISOString().slice(0, 10))
  const [fields, setFields] = useState<HeaderFields>(HEADER_EMPTY)
  const [linea, setLinea] = useState<MovimientoDetalleInput>(LINEA_EMPTY)
  const [editingLineaId, setEditingLineaId] = useState<number | null>(null)
  const [deleteLineaId, setDeleteLineaId] = useState<number | null>(null)
  const [confirmarOpen, setConfirmarOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const { data: movimientoRes, isLoading } = useQuery({ ...movimientoDetailOptions(movimientoId ?? 0), enabled: isEdit })
  const movimiento = movimientoRes?.data

  // Prellenado desde el botón "Registrar ingreso" de una Orden de Compra de
  // Materiales EMITIDA (materiales.md R22, /ordenes-compra/:id) — solo tiene
  // sentido antes de crear el borrador; una vez creado, el vínculo ya quedó
  // guardado en el Movimiento (ver createMutation.onSuccess más abajo).
  const ordenCompraMaterialIdParamRaw = searchParams.get('ordenCompraMaterialId')
  const ordenCompraMaterialIdParam = !isEdit && ordenCompraMaterialIdParamRaw ? Number(ordenCompraMaterialIdParamRaw) : null
  const { data: ocMaterialPrefill } = useQuery({
    queryKey: ['orden-compra-material-prefill', ordenCompraMaterialIdParam],
    queryFn: () => ordenesCompraMaterialService.getById(ordenCompraMaterialIdParam!),
    enabled: !!ordenCompraMaterialIdParam,
    staleTime: 60_000,
  })

  // Si viene desde "Registrar ingreso" de una OC de Materiales, solo tiene
  // sentido un tipo ENTRADA (materiales.md R22 — el vínculo se rechaza para
  // cualquier otra clase) — se filtra acá en vez de dejar que el usuario
  // elija cualquiera y descubra el rechazo recién al fallar el PATCH.
  const { data: tiposMovimiento } = useQuery({
    queryKey: ['tipos-movimiento-options', ordenCompraMaterialIdParam != null ? 'ENTRADA' : 'ALL'],
    queryFn: () => tiposMovimientoService.list({
      modulo: 'MATERIALES', activo: true, limit: 500,
      ...(ordenCompraMaterialIdParam != null ? { clase: 'ENTRADA' as const } : {}),
    }),
    staleTime: 60_000,
  })
  const tipoMovimiento = isEdit ? movimiento?.tipoMovimiento : tiposMovimiento?.data.find((t) => t.id === tipoMovimientoId)

  // Único tipo ENTRADA disponible al venir desde una OC: se preselecciona
  // solo (mismo criterio que dejar elegir cuando hay más de uno).
  useEffect(() => {
    if (ordenCompraMaterialIdParam == null || tipoMovimientoId != null) return
    const opciones = tiposMovimiento?.data ?? []
    // eslint-disable-next-line react-hooks/set-state-in-effect -- preselecciona el único tipo ENTRADA disponible al venir desde "Registrar ingreso" de una OC
    if (opciones.length === 1) setTipoMovimientoId(opciones[0].id)
  }, [ordenCompraMaterialIdParam, tipoMovimientoId, tiposMovimiento])

  const { data: entidades } = useQuery({
    queryKey: ['entidades-options-movimiento'],
    queryFn: () => entidadesService.list({ limit: 500 }),
    staleTime: 60_000,
    enabled: !!tipoMovimiento?.entidadRelacionada,
  })
  const entidadesFiltradas = (entidades?.data ?? []).filter(
    (e) => !tipoMovimiento?.entidadRelacionada || e.tipos.includes(tipoMovimiento.entidadRelacionada),
  )

  const { data: transportistas } = useQuery({
    queryKey: ['entidades-transporte-options'],
    queryFn: () => entidadesService.list({ tipo: 'EMPRESA_TRANSPORTE', limit: 500 }),
    staleTime: 60_000,
    enabled: !!tipoMovimiento?.emiteDTE,
  })

  const { data: bodegas } = useQuery({
    queryKey: ['bodegas-options-movimiento'],
    queryFn: () => bodegasService.list({ soloActivos: true, limit: 500 }),
    staleTime: 60_000,
  })

  const { data: articulos } = useQuery({
    queryKey: ['articulos-options-movimiento'],
    queryFn: () => articulosService.list({ activo: true, limit: 500 }),
    staleTime: 60_000,
  })

  useEffect(() => {
    if (!movimiento) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza el estado local del form con la respuesta del server al cargar/refrescar (mismo patrón que orden-compra-form.tsx)
    setFields({
      entidadId: movimiento.entidadId,
      fechaMovimiento: movimiento.fechaMovimiento.slice(0, 10),
      bodegaOrigenId: movimiento.bodegaOrigenId,
      bodegaDestinoId: movimiento.bodegaDestinoId,
      guiaReferencia: movimiento.guiaReferencia ?? '',
      transporteEntidadId: movimiento.transporteEntidadId,
      choferRut: movimiento.choferRut ?? '',
      choferNombre: movimiento.choferNombre ?? '',
      placaCamion: movimiento.placaCamion ?? '',
      placaRemolque: movimiento.placaRemolque ?? '',
      horaSalida: movimiento.horaSalida ? movimiento.horaSalida.slice(0, 16) : '',
      horaEstimadaLlegada: movimiento.horaEstimadaLlegada ? movimiento.horaEstimadaLlegada.slice(0, 16) : '',
    })
  }, [movimiento])

  const createMutation = useMutation({
    mutationFn: () => movimientosService.create({ tipoMovimientoId: tipoMovimientoId!, fechaMovimiento: toIsoLocal(true, fechaCrear) }),
    onSuccess: async (res) => {
      toast.success('Borrador de movimiento creado')
      // Vincula de inmediato con la OC de Materiales que originó este
      // ingreso (R22) y precarga la entidad proveedora — la cabecera recién
      // creada no tiene más datos que tipoMovimientoId/fechaMovimiento, así
      // que un PATCH aparte es la única forma de dejarlo guardado sin que el
      // usuario tenga que escribir el ID a mano.
      if (ordenCompraMaterialIdParam) {
        try {
          await movimientosService.update(res.data.id, {
            ordenCompraMaterialId: ordenCompraMaterialIdParam,
            entidadId: ocMaterialPrefill?.data.entidadProveedorId ?? null,
          })
          // Precarga una línea de Movimiento por cada línea de la OC (mismo
          // artículo/cantidad/precio) — el usuario las ajusta si el ingreso
          // real difiere (materiales.md R22 exige que todas estén presentes
          // al confirmar, con cantidad igual o menor).
          for (const linea of ocMaterialPrefill?.data.lineas ?? []) {
            await movimientosService.addLinea(res.data.id, {
              articuloId: linea.articuloId,
              cantidad: Number(linea.cantidad),
              precioUnitario: Number(linea.precioUnitario),
            })
          }
        } catch (e) {
          // Sin vínculo/líneas completos no queda un Movimiento útil para
          // este flujo — se compensa eliminando el borrador recién creado
          // (soft delete, todavía BORRADOR) en vez de redirigir a un registro
          // a medias que el usuario tendría que descubrir y corregir a mano.
          await movimientosService.remove(res.data.id).catch(() => {})
          queryClient.invalidateQueries({ queryKey: movimientosKeys.all })
          toast.error(e instanceof Error ? e.message : 'No se pudo registrar el ingreso contra la Orden de Compra de Materiales — inténtalo de nuevo')
          return
        }
      }
      queryClient.invalidateQueries({ queryKey: movimientosKeys.all })
      router.push(`/dashboard/operaciones/movimientos/${res.data.id}`)
    },
    onError: (e: Error) => toast.error(e.message || 'Error al crear el movimiento'),
  })

  function buildHeaderPayload(): MovimientoUpdateInput {
    return {
      entidadId: fields.entidadId,
      fechaMovimiento: toIsoLocal(true, fields.fechaMovimiento),
      bodegaOrigenId: fields.bodegaOrigenId,
      bodegaDestinoId: fields.bodegaDestinoId,
      guiaReferencia: fields.guiaReferencia.trim() || null,
      transporteEntidadId: fields.transporteEntidadId,
      choferRut: fields.choferRut.trim() || null,
      choferNombre: fields.choferNombre.trim() || null,
      placaCamion: fields.placaCamion.trim() || null,
      placaRemolque: fields.placaRemolque.trim() || null,
      horaSalida: fields.horaSalida ? toIsoLocal(false, fields.horaSalida) : null,
      horaEstimadaLlegada: fields.horaEstimadaLlegada ? toIsoLocal(false, fields.horaEstimadaLlegada) : null,
    }
  }

  const updateMutation = useMutation({
    mutationFn: () => movimientosService.update(movimientoId!, buildHeaderPayload()),
    onSuccess: () => {
      toast.success('Cabecera actualizada')
      queryClient.invalidateQueries({ queryKey: movimientosKeys.detail(movimientoId!) })
    },
    onError: (e: Error) => toast.error(e.message || 'Error al actualizar la cabecera'),
  })

  const deleteMutation = useMutation({
    mutationFn: () => movimientosService.remove(movimientoId!),
    onSuccess: () => {
      toast.success('Borrador eliminado')
      queryClient.invalidateQueries({ queryKey: movimientosKeys.all })
      router.push('/dashboard/operaciones/movimientos')
    },
    onError: (e: Error) => toast.error(e.message || 'Error al eliminar el movimiento'),
  })

  const addLineaMutation = useMutation({
    mutationFn: (data: MovimientoDetalleInput) => movimientosService.addLinea(movimientoId!, data),
    onSuccess: () => {
      toast.success('Línea agregada')
      setLinea(LINEA_EMPTY)
      queryClient.invalidateQueries({ queryKey: movimientosKeys.detail(movimientoId!) })
    },
    onError: (e: Error) => toast.error(e.message || 'Error al agregar la línea'),
  })

  const updateLineaMutation = useMutation({
    mutationFn: (data: MovimientoDetalleInput) => movimientosService.updateLinea(movimientoId!, editingLineaId!, data),
    onSuccess: () => {
      toast.success('Línea actualizada')
      setLinea(LINEA_EMPTY)
      setEditingLineaId(null)
      queryClient.invalidateQueries({ queryKey: movimientosKeys.detail(movimientoId!) })
    },
    onError: (e: Error) => toast.error(e.message || 'Error al actualizar la línea'),
  })

  const removeLineaMutation = useMutation({
    mutationFn: (detalleId: number) => movimientosService.removeLinea(movimientoId!, detalleId),
    onSuccess: () => {
      toast.success('Línea eliminada')
      setDeleteLineaId(null)
      queryClient.invalidateQueries({ queryKey: movimientosKeys.detail(movimientoId!) })
    },
    onError: (e: Error) => toast.error(e.message || 'Error al eliminar la línea'),
  })

  const confirmarMutation = useMutation({
    mutationFn: () => movimientosService.confirmar(movimientoId!),
    onSuccess: () => {
      toast.success('Movimiento confirmado — el saldo ya se actualizó')
      setConfirmarOpen(false)
      queryClient.invalidateQueries({ queryKey: movimientosKeys.detail(movimientoId!) })
      queryClient.invalidateQueries({ queryKey: movimientosKeys.all })
    },
    onError: (e: Error) => toast.error(e.message || 'Error al confirmar el movimiento'),
  })

  function handleGuardarLinea() {
    if (editingLineaId) updateLineaMutation.mutate(linea)
    else addLineaMutation.mutate(linea)
  }

  function handleEditarLinea(d: MovimientoDetalleItem) {
    setEditingLineaId(d.id)
    setLinea({ articuloId: d.articuloId, cantidad: Number(d.cantidad), precioUnitario: d.precioUnitario != null ? Number(d.precioUnitario) : null })
  }

  function handleCancelarEdicionLinea() {
    setEditingLineaId(null)
    setLinea(LINEA_EMPTY)
  }

  if (!isEdit) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Nuevo movimiento</CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          {ordenCompraMaterialIdParam && (
            <Badge variant='outline'>
              Se vinculará a la Orden de Compra de Materiales {ocMaterialPrefill?.data.numero ?? `#${ordenCompraMaterialIdParam}`}
              {ocMaterialPrefill?.data.entidadProveedor ? ` — ${ocMaterialPrefill.data.entidadProveedor.descripcion}` : ''}
            </Badge>
          )}
          <div className='space-y-1.5'>
            <Label>Tipo de movimiento <span className='text-destructive'>*</span></Label>
            <Select value={tipoMovimientoId ? String(tipoMovimientoId) : ''} onValueChange={(v) => setTipoMovimientoId(parseInt(v))}>
              <SelectTrigger><SelectValue placeholder='Seleccionar tipo...' /></SelectTrigger>
              <SelectContent>
                {(tiposMovimiento?.data ?? []).map((t) => (
                  <SelectItem key={t.id} value={String(t.id)}>{t.descripcion} ({t.clase})</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className='text-muted-foreground text-xs'>No se puede cambiar después de crear el borrador.</p>
          </div>
          <div className='space-y-1.5'>
            <Label>Fecha de movimiento <span className='text-destructive'>*</span></Label>
            <Input type='date' value={fechaCrear} onChange={(e) => setFechaCrear(e.target.value)} />
          </div>
          <Button
            onClick={() => createMutation.mutate()}
            isLoading={createMutation.isPending}
            disabled={!tipoMovimientoId || !puedeEscribir || (ordenCompraMaterialIdParam != null && !ocMaterialPrefill)}
          >
            <Icons.check className='mr-1 h-4 w-4' /> Crear borrador
          </Button>
          {!puedeEscribir && (
            <p className='text-destructive text-xs'>No tienes permiso para crear movimientos de Materiales.</p>
          )}
        </CardContent>
      </Card>
    )
  }

  if (isLoading || !movimiento) {
    return <p className='text-sm text-muted-foreground'>Cargando…</p>
  }

  const soloLectura = !puedeEscribir || movimiento.estado === 'CONFIRMADO'
  const lineaMutationPending = addLineaMutation.isPending || updateLineaMutation.isPending

  return (
    <div className='space-y-6'>
      <div className='flex items-center gap-2'>
        <Badge variant={movimiento.estado === 'CONFIRMADO' ? 'default' : 'secondary'}>
          {ESTADO_MOVIMIENTO_LABELS[movimiento.estado]}
        </Badge>
        {soloLectura && movimiento.estado === 'CONFIRMADO' && (
          <span className='text-muted-foreground text-xs'>Confirmado — ya aplicó su efecto en el saldo, no se puede editar.</span>
        )}
        {movimiento.ordenCompraMaterialId && (
          <Button asChild type='button' variant='link' size='sm' className='h-auto p-0 text-xs'>
            <Link href={`/dashboard/operaciones/materiales/ordenes-compra/${movimiento.ordenCompraMaterialId}`}>
              Ver Orden de Compra de Materiales vinculada
            </Link>
          </Button>
        )}
      </div>

      <fieldset disabled={soloLectura} className='m-0 space-y-6 border-0 p-0'>
        <Card>
          <CardHeader>
            <CardTitle>Movimiento — {movimiento.tipoMovimiento.descripcion} ({movimiento.tipoMovimiento.clase})</CardTitle>
          </CardHeader>
          <CardContent className='space-y-4'>
            {tipoMovimiento?.entidadRelacionada && (
              <div className='space-y-1.5'>
                <Label>Entidad ({tipoMovimiento.entidadRelacionada}) <span className='text-destructive'>*</span></Label>
                <Select value={fields.entidadId ? String(fields.entidadId) : ''} onValueChange={(v) => setFields((f) => ({ ...f, entidadId: parseInt(v) }))}>
                  <SelectTrigger><SelectValue placeholder='Seleccionar entidad...' /></SelectTrigger>
                  <SelectContent>
                    {entidadesFiltradas.map((e) => (
                      <SelectItem key={e.id} value={String(e.id)}>{e.descripcion}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className='grid grid-cols-2 gap-3'>
              <div className='space-y-1.5'>
                <Label>Fecha de movimiento <span className='text-destructive'>*</span></Label>
                <Input type='date' value={fields.fechaMovimiento} onChange={(e) => setFields((f) => ({ ...f, fechaMovimiento: e.target.value }))} />
              </div>
              <div className='space-y-1.5'>
                <Label>Guía / Referencia</Label>
                <Input value={fields.guiaReferencia} onChange={(e) => setFields((f) => ({ ...f, guiaReferencia: e.target.value }))} />
              </div>
            </div>

            <div className='grid grid-cols-2 gap-3'>
              {(tipoMovimiento?.clase === 'SALIDA' || tipoMovimiento?.clase === 'TRASLADO') && (
                <div className='space-y-1.5'>
                  <Label>Bodega origen <span className='text-destructive'>*</span></Label>
                  <Select value={fields.bodegaOrigenId ? String(fields.bodegaOrigenId) : ''} onValueChange={(v) => setFields((f) => ({ ...f, bodegaOrigenId: parseInt(v) }))}>
                    <SelectTrigger><SelectValue placeholder='Seleccionar bodega...' /></SelectTrigger>
                    <SelectContent>
                      {(bodegas?.data ?? []).map((b) => (
                        <SelectItem key={b.id} value={String(b.id)}>{b.descripcion}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {(tipoMovimiento?.clase === 'ENTRADA' || tipoMovimiento?.clase === 'TRASLADO') && (
                <div className='space-y-1.5'>
                  <Label>Bodega destino <span className='text-destructive'>*</span></Label>
                  <Select value={fields.bodegaDestinoId ? String(fields.bodegaDestinoId) : ''} onValueChange={(v) => setFields((f) => ({ ...f, bodegaDestinoId: parseInt(v) }))}>
                    <SelectTrigger><SelectValue placeholder='Seleccionar bodega...' /></SelectTrigger>
                    <SelectContent>
                      {(bodegas?.data ?? []).map((b) => (
                        <SelectItem key={b.id} value={String(b.id)}>{b.descripcion}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {tipoMovimiento?.emiteDTE && (
              <div className='space-y-3 rounded-md border p-3'>
                <p className='text-sm font-medium'>Datos de transporte (DTE)</p>
                <div className='space-y-1.5'>
                  <Label>Empresa de transporte <span className='text-destructive'>*</span></Label>
                  <Select value={fields.transporteEntidadId ? String(fields.transporteEntidadId) : ''} onValueChange={(v) => setFields((f) => ({ ...f, transporteEntidadId: parseInt(v) }))}>
                    <SelectTrigger><SelectValue placeholder='Seleccionar...' /></SelectTrigger>
                    <SelectContent>
                      {(transportistas?.data ?? []).map((t) => (
                        <SelectItem key={t.id} value={String(t.id)}>{t.descripcion}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className='grid grid-cols-2 gap-3'>
                  <div className='space-y-1.5'>
                    <Label>RUT chofer <span className='text-destructive'>*</span></Label>
                    <Input value={fields.choferRut} onChange={(e) => setFields((f) => ({ ...f, choferRut: e.target.value }))} />
                  </div>
                  <div className='space-y-1.5'>
                    <Label>Nombre chofer <span className='text-destructive'>*</span></Label>
                    <Input value={fields.choferNombre} onChange={(e) => setFields((f) => ({ ...f, choferNombre: e.target.value }))} />
                  </div>
                  <div className='space-y-1.5'>
                    <Label>Placa camión <span className='text-destructive'>*</span></Label>
                    <Input value={fields.placaCamion} onChange={(e) => setFields((f) => ({ ...f, placaCamion: e.target.value }))} />
                  </div>
                  <div className='space-y-1.5'>
                    <Label>Placa remolque</Label>
                    <Input value={fields.placaRemolque} onChange={(e) => setFields((f) => ({ ...f, placaRemolque: e.target.value }))} />
                  </div>
                  <div className='space-y-1.5'>
                    <Label>Hora salida <span className='text-destructive'>*</span></Label>
                    <Input type='datetime-local' value={fields.horaSalida} onChange={(e) => setFields((f) => ({ ...f, horaSalida: e.target.value }))} />
                  </div>
                  <div className='space-y-1.5'>
                    <Label>Hora estimada llegada</Label>
                    <Input type='datetime-local' value={fields.horaEstimadaLlegada} onChange={(e) => setFields((f) => ({ ...f, horaEstimadaLlegada: e.target.value }))} />
                  </div>
                </div>
              </div>
            )}

            <Button onClick={() => updateMutation.mutate()} isLoading={updateMutation.isPending} variant='outline'>
              Guardar cabecera
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Detalle</CardTitle>
          </CardHeader>
          <CardContent className='space-y-4'>
            {movimiento.detalle.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Artículo</TableHead>
                    <TableHead>Cantidad</TableHead>
                    {tipoMovimiento?.requierePrecio && <TableHead>Precio Unitario</TableHead>}
                    <TableHead className='w-24'>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movimiento.detalle.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell>{d.articulo.codigo} — {d.articulo.descripcion}</TableCell>
                      <TableCell>{d.cantidad}</TableCell>
                      {tipoMovimiento?.requierePrecio && <TableCell>{d.precioUnitario ?? '—'}</TableCell>}
                      <TableCell>
                        <div className='flex gap-1'>
                          <Button type='button' variant='ghost' size='icon' className='h-8 w-8' onClick={() => handleEditarLinea(d)}>
                            <Icons.edit className='h-4 w-4' />
                          </Button>
                          <Button type='button' variant='ghost' size='icon' className='h-8 w-8' onClick={() => setDeleteLineaId(d.id)}>
                            <Icons.trash className='h-4 w-4' />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            <Separator />

            <div className='flex flex-wrap items-end gap-2'>
              <div className='space-y-1.5'>
                <Label>Artículo</Label>
                <Select value={linea.articuloId ? String(linea.articuloId) : ''} onValueChange={(v) => setLinea((l) => ({ ...l, articuloId: parseInt(v) }))}>
                  <SelectTrigger className='w-64'><SelectValue placeholder='Seleccionar artículo...' /></SelectTrigger>
                  <SelectContent>
                    {(articulos?.data ?? []).map((a) => (
                      <SelectItem key={a.id} value={String(a.id)}>{a.codigo} — {a.descripcion}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className='space-y-1.5'>
                <Label>Cantidad</Label>
                <Input
                  type='number' step='0.001' className='w-28'
                  value={linea.cantidad || ''} onChange={(e) => setLinea((l) => ({ ...l, cantidad: Number(e.target.value) }))}
                />
              </div>
              {tipoMovimiento?.requierePrecio && (
                <div className='space-y-1.5'>
                  <Label>Precio Unitario</Label>
                  <Input
                    type='number' step='0.01' className='w-28'
                    value={linea.precioUnitario ?? ''} onChange={(e) => setLinea((l) => ({ ...l, precioUnitario: Number(e.target.value) }))}
                  />
                </div>
              )}
              <Button type='button' onClick={handleGuardarLinea} isLoading={lineaMutationPending} disabled={!linea.articuloId || !linea.cantidad}>
                <Icons.add className='mr-1 h-4 w-4' /> {editingLineaId ? 'Guardar línea' : 'Agregar línea'}
              </Button>
              {editingLineaId && (
                <Button type='button' variant='outline' onClick={handleCancelarEdicionLinea}>Cancelar</Button>
              )}
            </div>
          </CardContent>
        </Card>
      </fieldset>

      {!soloLectura && (
        <div className='flex justify-between'>
          <Button variant='destructive' onClick={() => setDeleteOpen(true)}>
            <Icons.trash className='mr-1 h-4 w-4' /> Eliminar borrador
          </Button>
          <Button onClick={() => setConfirmarOpen(true)} disabled={movimiento.detalle.length === 0}>
            <Icons.check className='mr-1 h-4 w-4' /> Confirmar movimiento
          </Button>
        </div>
      )}

      <AlertModal
        isOpen={confirmarOpen}
        onClose={() => setConfirmarOpen(false)}
        onConfirm={() => confirmarMutation.mutate()}
        loading={confirmarMutation.isPending}
        title='Confirmar movimiento'
        description='Al confirmar se aplica de inmediato el efecto en el saldo (cantidad y costo promedio) y el movimiento queda inmutable. Esta acción no se puede deshacer.'
      />
      <AlertModal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => deleteMutation.mutate()}
        loading={deleteMutation.isPending}
      />
      <AlertModal
        isOpen={deleteLineaId != null}
        onClose={() => setDeleteLineaId(null)}
        onConfirm={() => removeLineaMutation.mutate(deleteLineaId!)}
        loading={removeLineaMutation.isPending}
      />
    </div>
  )
}
