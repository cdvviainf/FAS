'use client'

import { useState, useEffect, useMemo } from 'react'
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
import { Icons } from '@/components/icons'
import { entidadesService } from '@/features/entidades/service'
import { createMantenedorService } from '@/features/mantenedor-simple/service'
import { articulosService } from '../../articulos/service'
import { tiposMovimientoService } from '../../tipos-movimiento/service'
import { movimientosService } from '../service'
import { movimientosKeys } from '../queries'
import type { MovimientoDetalleInput } from '../types'

const bodegasService = createMantenedorService('bodegas')

interface MovimientoFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function toIsoLocal(dateOnly: boolean, value: string): string {
  if (dateOnly) return new Date(`${value}T00:00:00`).toISOString()
  return new Date(value).toISOString()
}

export function MovimientoFormSheet({ open, onOpenChange }: MovimientoFormSheetProps) {
  const queryClient = useQueryClient()

  const [tipoMovimientoId, setTipoMovimientoId] = useState<number | null>(null)
  const [entidadId, setEntidadId] = useState<number | null>(null)
  const [fechaMovimiento, setFechaMovimiento] = useState('')
  const [bodegaOrigenId, setBodegaOrigenId] = useState<number | null>(null)
  const [bodegaDestinoId, setBodegaDestinoId] = useState<number | null>(null)
  const [guiaReferencia, setGuiaReferencia] = useState('')
  const [transporteEntidadId, setTransporteEntidadId] = useState<number | null>(null)
  const [choferRut, setChoferRut] = useState('')
  const [choferNombre, setChoferNombre] = useState('')
  const [placaCamion, setPlacaCamion] = useState('')
  const [placaRemolque, setPlacaRemolque] = useState('')
  const [horaSalida, setHoraSalida] = useState('')
  const [horaEstimadaLlegada, setHoraEstimadaLlegada] = useState('')
  const [detalle, setDetalle] = useState<MovimientoDetalleInput[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})

  const { data: tiposMovimiento } = useQuery({
    queryKey: ['tipos-movimiento-options'],
    queryFn: () => tiposMovimientoService.list({ modulo: 'MATERIALES', activo: true, limit: 500 }),
    staleTime: 60_000,
    enabled: open,
  })
  const tipoMovimiento = tiposMovimiento?.data.find((t) => t.id === tipoMovimientoId)

  const { data: entidades } = useQuery({
    queryKey: ['entidades-options-movimiento'],
    queryFn: () => entidadesService.list({ limit: 500 }),
    staleTime: 60_000,
    enabled: open && !!tipoMovimiento?.entidadRelacionada,
  })
  const entidadesFiltradas = (entidades?.data ?? []).filter(
    (e) => !tipoMovimiento?.entidadRelacionada || e.tipos.includes(tipoMovimiento.entidadRelacionada),
  )

  const { data: transportistas } = useQuery({
    queryKey: ['entidades-transporte-options'],
    queryFn: () => entidadesService.list({ tipo: 'EMPRESA_TRANSPORTE', limit: 500 }),
    staleTime: 60_000,
    enabled: open && !!tipoMovimiento?.emiteDTE,
  })

  const { data: bodegas } = useQuery({
    queryKey: ['bodegas-options-movimiento'],
    queryFn: () => bodegasService.list({ soloActivos: true, limit: 500 }),
    staleTime: 60_000,
    enabled: open,
  })

  const { data: articulos } = useQuery({
    queryKey: ['articulos-options-movimiento'],
    queryFn: () => articulosService.list({ activo: true, limit: 500 }),
    staleTime: 60_000,
    enabled: open,
  })

  useEffect(() => {
    if (!open) return
    setErrors({})
    setTipoMovimientoId(null)
    setEntidadId(null)
    setFechaMovimiento('')
    setBodegaOrigenId(null)
    setBodegaDestinoId(null)
    setGuiaReferencia('')
    setTransporteEntidadId(null)
    setChoferRut('')
    setChoferNombre('')
    setPlacaCamion('')
    setPlacaRemolque('')
    setHoraSalida('')
    setHoraEstimadaLlegada('')
    setDetalle([])
  }, [open])

  const mutation = useMutation({
    mutationFn: () => movimientosService.create({
      tipoMovimientoId: tipoMovimientoId!,
      entidadId,
      fechaMovimiento: toIsoLocal(true, fechaMovimiento),
      bodegaOrigenId,
      bodegaDestinoId,
      guiaReferencia: guiaReferencia.trim() || null,
      transporteEntidadId,
      choferRut: choferRut.trim() || null,
      choferNombre: choferNombre.trim() || null,
      placaCamion: placaCamion.trim() || null,
      placaRemolque: placaRemolque.trim() || null,
      horaSalida: horaSalida ? toIsoLocal(false, horaSalida) : null,
      horaEstimadaLlegada: horaEstimadaLlegada ? toIsoLocal(false, horaEstimadaLlegada) : null,
      detalle,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: movimientosKeys.all })
      toast.success('Movimiento registrado')
      onOpenChange(false)
    },
    onError: (e: Error) => toast.error(e.message || 'Error al registrar el movimiento'),
  })

  function agregarArticulo(articuloId: string) {
    const id = parseInt(articuloId)
    if (detalle.some((d) => d.articuloId === id)) return
    setDetalle((prev) => [...prev, { articuloId: id, cantidad: 1, precioUnitario: null }])
  }
  function actualizarLinea(articuloId: number, campo: 'cantidad' | 'precioUnitario', valor: number) {
    setDetalle((prev) => prev.map((d) => d.articuloId === articuloId ? { ...d, [campo]: valor } : d))
  }
  function quitarLinea(articuloId: number) {
    setDetalle((prev) => prev.filter((d) => d.articuloId !== articuloId))
  }
  const nombreArticulo = useMemo(() => (id: number) => articulos?.data.find((a) => a.id === id)?.descripcion ?? String(id), [articulos])

  function validar(): boolean {
    const e: Record<string, string> = {}
    if (!tipoMovimientoId) e.tipoMovimientoId = 'El tipo de movimiento es requerido'
    if (!fechaMovimiento) e.fechaMovimiento = 'La fecha es requerida'
    if (tipoMovimiento?.clase === 'ENTRADA' && !bodegaDestinoId) e.bodegaDestinoId = 'Requerida para Entrada'
    if (tipoMovimiento?.clase === 'SALIDA' && !bodegaOrigenId) e.bodegaOrigenId = 'Requerida para Salida'
    if (tipoMovimiento?.clase === 'TRASLADO' && (!bodegaOrigenId || !bodegaDestinoId)) e.bodegaOrigenId = 'Origen y destino requeridos para Traslado'
    if (tipoMovimiento?.entidadRelacionada && !entidadId) e.entidadId = `Requiere entidad de tipo ${tipoMovimiento.entidadRelacionada}`
    if (detalle.length === 0) e.detalle = 'Debe agregar al menos un artículo'
    if (tipoMovimiento?.requierePrecio && detalle.some((d) => d.precioUnitario == null)) {
      e.detalle = 'Todas las líneas requieren precio unitario'
    }
    if (tipoMovimiento?.emiteDTE) {
      if (!transporteEntidadId) e.transporteEntidadId = 'Requerida'
      if (!choferRut.trim()) e.choferRut = 'Requerido'
      if (!choferNombre.trim()) e.choferNombre = 'Requerido'
      if (!placaCamion.trim()) e.placaCamion = 'Requerida'
      if (!horaSalida) e.horaSalida = 'Requerida'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit() {
    if (!validar()) return
    mutation.mutate()
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='flex w-full flex-col sm:max-w-xl'>
        <SheetHeader>
          <SheetTitle>Nuevo movimiento</SheetTitle>
          <SheetDescription>Los movimientos no se editan ni se borran; se corrigen con uno inverso (R1).</SheetDescription>
        </SheetHeader>

        <div className='flex-1 space-y-4 overflow-auto px-1 py-2'>
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
            {errors.tipoMovimientoId && <p className='text-xs text-destructive'>{errors.tipoMovimientoId}</p>}
          </div>

          {tipoMovimiento?.entidadRelacionada && (
            <div className='space-y-1.5'>
              <Label>Entidad ({tipoMovimiento.entidadRelacionada}) <span className='text-destructive'>*</span></Label>
              <Select value={entidadId ? String(entidadId) : ''} onValueChange={(v) => setEntidadId(parseInt(v))}>
                <SelectTrigger><SelectValue placeholder='Seleccionar entidad...' /></SelectTrigger>
                <SelectContent>
                  {entidadesFiltradas.map((e) => (
                    <SelectItem key={e.id} value={String(e.id)}>{e.descripcion}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.entidadId && <p className='text-xs text-destructive'>{errors.entidadId}</p>}
            </div>
          )}

          <div className='grid grid-cols-2 gap-3'>
            <div className='space-y-1.5'>
              <Label>Fecha de movimiento <span className='text-destructive'>*</span></Label>
              <Input type='date' value={fechaMovimiento} onChange={(e) => setFechaMovimiento(e.target.value)} />
              {errors.fechaMovimiento && <p className='text-xs text-destructive'>{errors.fechaMovimiento}</p>}
            </div>
            <div className='space-y-1.5'>
              <Label>Guía / Referencia</Label>
              <Input value={guiaReferencia} onChange={(e) => setGuiaReferencia(e.target.value)} />
            </div>
          </div>

          {(tipoMovimiento?.clase === 'SALIDA' || tipoMovimiento?.clase === 'TRASLADO') && (
            <div className='space-y-1.5'>
              <Label>Bodega origen <span className='text-destructive'>*</span></Label>
              <Select value={bodegaOrigenId ? String(bodegaOrigenId) : ''} onValueChange={(v) => setBodegaOrigenId(parseInt(v))}>
                <SelectTrigger><SelectValue placeholder='Seleccionar bodega...' /></SelectTrigger>
                <SelectContent>
                  {(bodegas?.data ?? []).map((b) => (
                    <SelectItem key={b.id} value={String(b.id)}>{b.descripcion}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.bodegaOrigenId && <p className='text-xs text-destructive'>{errors.bodegaOrigenId}</p>}
            </div>
          )}
          {(tipoMovimiento?.clase === 'ENTRADA' || tipoMovimiento?.clase === 'TRASLADO') && (
            <div className='space-y-1.5'>
              <Label>Bodega destino <span className='text-destructive'>*</span></Label>
              <Select value={bodegaDestinoId ? String(bodegaDestinoId) : ''} onValueChange={(v) => setBodegaDestinoId(parseInt(v))}>
                <SelectTrigger><SelectValue placeholder='Seleccionar bodega...' /></SelectTrigger>
                <SelectContent>
                  {(bodegas?.data ?? []).map((b) => (
                    <SelectItem key={b.id} value={String(b.id)}>{b.descripcion}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.bodegaDestinoId && <p className='text-xs text-destructive'>{errors.bodegaDestinoId}</p>}
            </div>
          )}

          {/* Artículos */}
          <div className='space-y-2'>
            <Label>Artículos <span className='text-destructive'>*</span></Label>
            <Select value='' onValueChange={agregarArticulo}>
              <SelectTrigger><SelectValue placeholder='Agregar artículo...' /></SelectTrigger>
              <SelectContent>
                {(articulos?.data ?? []).map((a) => (
                  <SelectItem key={a.id} value={String(a.id)}>{a.codigo} — {a.descripcion}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {detalle.length > 0 && (
              <div className='space-y-2 rounded-md border p-2'>
                {detalle.map((d) => (
                  <div key={d.articuloId} className='flex items-center gap-2'>
                    <span className='flex-1 text-sm'>{nombreArticulo(d.articuloId)}</span>
                    <Input
                      type='number' step='0.001' className='w-24' placeholder='Cantidad'
                      value={d.cantidad} onChange={(e) => actualizarLinea(d.articuloId, 'cantidad', Number(e.target.value))}
                    />
                    {tipoMovimiento?.requierePrecio && (
                      <Input
                        type='number' step='0.01' className='w-28' placeholder='Precio'
                        value={d.precioUnitario ?? ''} onChange={(e) => actualizarLinea(d.articuloId, 'precioUnitario', Number(e.target.value))}
                      />
                    )}
                    <Button type='button' variant='ghost' size='icon' className='h-8 w-8' onClick={() => quitarLinea(d.articuloId)}>
                      <Icons.trash className='h-4 w-4' />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            {errors.detalle && <p className='text-xs text-destructive'>{errors.detalle}</p>}
          </div>

          {/* Bloque DTE */}
          {tipoMovimiento?.emiteDTE && (
            <div className='space-y-3 rounded-md border p-3'>
              <p className='text-sm font-medium'>Datos de transporte (DTE)</p>
              <div className='space-y-1.5'>
                <Label>Empresa de transporte <span className='text-destructive'>*</span></Label>
                <Select value={transporteEntidadId ? String(transporteEntidadId) : ''} onValueChange={(v) => setTransporteEntidadId(parseInt(v))}>
                  <SelectTrigger><SelectValue placeholder='Seleccionar...' /></SelectTrigger>
                  <SelectContent>
                    {(transportistas?.data ?? []).map((t) => (
                      <SelectItem key={t.id} value={String(t.id)}>{t.descripcion}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.transporteEntidadId && <p className='text-xs text-destructive'>{errors.transporteEntidadId}</p>}
              </div>
              <div className='grid grid-cols-2 gap-3'>
                <div className='space-y-1.5'>
                  <Label>RUT chofer <span className='text-destructive'>*</span></Label>
                  <Input value={choferRut} onChange={(e) => setChoferRut(e.target.value)} />
                  {errors.choferRut && <p className='text-xs text-destructive'>{errors.choferRut}</p>}
                </div>
                <div className='space-y-1.5'>
                  <Label>Nombre chofer <span className='text-destructive'>*</span></Label>
                  <Input value={choferNombre} onChange={(e) => setChoferNombre(e.target.value)} />
                  {errors.choferNombre && <p className='text-xs text-destructive'>{errors.choferNombre}</p>}
                </div>
                <div className='space-y-1.5'>
                  <Label>Placa camión <span className='text-destructive'>*</span></Label>
                  <Input value={placaCamion} onChange={(e) => setPlacaCamion(e.target.value)} />
                  {errors.placaCamion && <p className='text-xs text-destructive'>{errors.placaCamion}</p>}
                </div>
                <div className='space-y-1.5'>
                  <Label>Placa remolque</Label>
                  <Input value={placaRemolque} onChange={(e) => setPlacaRemolque(e.target.value)} />
                </div>
                <div className='space-y-1.5'>
                  <Label>Hora salida <span className='text-destructive'>*</span></Label>
                  <Input type='datetime-local' value={horaSalida} onChange={(e) => setHoraSalida(e.target.value)} />
                  {errors.horaSalida && <p className='text-xs text-destructive'>{errors.horaSalida}</p>}
                </div>
                <div className='space-y-1.5'>
                  <Label>Hora estimada llegada</Label>
                  <Input type='datetime-local' value={horaEstimadaLlegada} onChange={(e) => setHoraEstimadaLlegada(e.target.value)} />
                </div>
              </div>
            </div>
          )}
        </div>

        <SheetFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)} disabled={mutation.isPending}>Cancelar</Button>
          <Button onClick={handleSubmit} isLoading={mutation.isPending}>
            <Icons.check className='mr-1 h-4 w-4' /> Registrar movimiento
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

export function MovimientoFormSheetTrigger() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Icons.add className='mr-2 h-4 w-4' /> Nuevo Movimiento
      </Button>
      <MovimientoFormSheet open={open} onOpenChange={setOpen} />
    </>
  )
}
