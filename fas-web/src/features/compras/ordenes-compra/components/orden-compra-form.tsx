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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Icons } from '@/components/icons'
import { Badge } from '@/components/ui/badge'
import { usePuedeEscribir } from '@/hooks/use-item-acceso'
import { createMantenedorService } from '@/features/mantenedor-simple/service'
import { entidadesService } from '@/features/entidades/service'
import { articulosService } from '@/features/materiales/articulos/service'
import { notasVentaService } from '@/features/ventas/notas-venta/service'
import { ordenCompraDetailOptions, ordenesCompraKeys } from '../queries'
import { ordenesCompraService } from '../service'
import type {
  OrdenCompraCreateInput,
  OrdenCompraLineaInput,
  OrdenCompraCuotaPagoInput,
  EstadoOrdenCompra,
} from '../types'
import { ESTADO_OC_LABELS } from '../types'

const monedasService = createMantenedorService('monedas')
const especiesService = createMantenedorService('especies')
const variedadesService = createMantenedorService('variedades')
const categoriasService = createMantenedorService('categorias')
const calibresService = createMantenedorService('calibres')

interface HeaderFields {
  entidadProductorId: number
  notaVentaId: number | null
  fecha: string
  formaPago: string
  condicionPagoTexto: string
  monedaId: number
  facturarAId: number | null
  observaciones: string
  estado: EstadoOrdenCompra
}

const HEADER_EMPTY: HeaderFields = {
  entidadProductorId: 0,
  notaVentaId: null,
  fecha: new Date().toISOString().slice(0, 10),
  formaPago: '',
  condicionPagoTexto: '',
  monedaId: 0,
  facturarAId: null,
  observaciones: '',
  estado: 'BORRADOR',
}

function nuevaLineaVacia(): OrdenCompraLineaInput & { especieId: number } {
  return {
    especieId: 0,
    variedadId: 0,
    categoriaId: 0,
    articuloId: 0,
    calibreMinId: 0,
    calibreMaxId: 0,
    cantidadPallets: 0,
    cajasPorPallet: 0,
    precioUsdCaja: 0,
  }
}

function nuevaCuotaVacia(): OrdenCompraCuotaPagoInput {
  return { porcentaje: 0, plazoDias: 0, descripcion: '' }
}

interface OrdenCompraFormProps {
  ordenCompraId?: number
}

const ITEM = 'compras.ordenes'

export function OrdenCompraForm({ ordenCompraId }: OrdenCompraFormProps) {
  const isEdit = !!ordenCompraId
  const router = useRouter()
  const queryClient = useQueryClient()
  const puedeEscribir = usePuedeEscribir(ITEM)

  const [fields, setFields] = useState<HeaderFields>(HEADER_EMPTY)
  const [lineas, setLineas] = useState<OrdenCompraLineaInput[]>([nuevaLineaVacia()])
  const [cuotas, setCuotas] = useState<OrdenCompraCuotaPagoInput[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})

  const { data: ordenCompra, isLoading } = useQuery({
    ...ordenCompraDetailOptions(ordenCompraId ?? 0),
    enabled: isEdit,
  })

  const { data: productoresData } = useQuery({
    queryKey: ['entidades-productores-options'],
    queryFn: () => entidadesService.list({ tipo: 'PRODUCTOR', limit: 500, activo: true }),
    staleTime: 60_000,
  })
  const { data: entidadesData } = useQuery({
    queryKey: ['entidades-todas-options'],
    queryFn: () => entidadesService.list({ limit: 500, activo: true }),
    staleTime: 60_000,
  })
  const { data: notasVentaData } = useQuery({
    queryKey: ['notas-venta-options'],
    queryFn: () => notasVentaService.list({ limit: 200 }),
    staleTime: 60_000,
  })
  const { data: monedasData } = useQuery({ queryKey: ['monedas-options'], queryFn: () => monedasService.list({ limit: 200 }), staleTime: 5 * 60_000 })
  const { data: especiesData } = useQuery({ queryKey: ['especies-options'], queryFn: () => especiesService.list({ limit: 200 }), staleTime: 5 * 60_000 })
  const { data: articulosData } = useQuery({ queryKey: ['articulos-embalaje-options'], queryFn: () => articulosService.list({ limit: 500, tipo: 'EMBALAJE', activo: true }), staleTime: 60_000 })

  const productores = productoresData?.data ?? []
  const entidades = entidadesData?.data ?? []
  const especies = especiesData?.data ?? []
  const articulos = articulosData?.data ?? []

  useEffect(() => {
    if (ordenCompra) {
      const d = ordenCompra.data
      setFields({
        entidadProductorId: d.entidadProductorId,
        notaVentaId: d.notaVentaId,
        fecha: d.fecha.slice(0, 10),
        formaPago: d.formaPago ?? '',
        condicionPagoTexto: d.condicionPagoTexto ?? '',
        monedaId: d.monedaId,
        facturarAId: d.facturarAId,
        observaciones: d.observaciones ?? '',
        estado: d.estado,
      })
      setLineas(d.lineas.map((l) => ({
        especieId: l.especieId,
        variedadId: l.variedadId,
        categoriaId: l.categoriaId,
        articuloId: l.articuloId,
        calibreMinId: l.calibreMinId,
        calibreMaxId: l.calibreMaxId,
        cantidadPallets: l.cantidadPallets,
        cajasPorPallet: l.cajasPorPallet,
        precioUsdCaja: Number(l.precioUsdCaja),
      })))
      setCuotas(d.cuotasPago.map((c) => ({
        porcentaje: Number(c.porcentaje),
        plazoDias: c.plazoDias,
        descripcion: c.descripcion ?? '',
      })))
    }
  }, [ordenCompra])

  function actualizarLinea(index: number, cambios: Partial<OrdenCompraLineaInput>) {
    setLineas((prev) => prev.map((l, i) => (i === index ? { ...l, ...cambios } : l)))
  }
  function agregarLinea() {
    setLineas((prev) => [...prev, nuevaLineaVacia()])
  }
  function quitarLinea(index: number) {
    setLineas((prev) => prev.filter((_, i) => i !== index))
  }

  function actualizarCuota(index: number, cambios: Partial<OrdenCompraCuotaPagoInput>) {
    setCuotas((prev) => prev.map((c, i) => (i === index ? { ...c, ...cambios } : c)))
  }
  function agregarCuota() {
    setCuotas((prev) => [...prev, nuevaCuotaVacia()])
  }
  function quitarCuota(index: number) {
    setCuotas((prev) => prev.filter((_, i) => i !== index))
  }

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!fields.entidadProductorId) e.entidadProductorId = 'El productor es requerido'
    if (!fields.monedaId) e.monedaId = 'La moneda es requerida'
    if (lineas.length === 0) e.lineas = 'Debe agregar al menos una línea'
    lineas.forEach((l, i) => {
      if (!l.especieId || !l.variedadId || !l.categoriaId || !l.articuloId || !l.calibreMinId || !l.calibreMaxId) {
        e[`linea-${i}`] = `Línea ${i + 1}: completa todos los campos`
      }
      if (!l.cantidadPallets || !l.cajasPorPallet) {
        e[`linea-${i}-cant`] = `Línea ${i + 1}: pallets y cajas deben ser mayores a 0`
      }
    })
    const sumaCuotas = cuotas.reduce((acc, c) => acc + (c.porcentaje || 0), 0)
    if (cuotas.length > 0 && Math.round(sumaCuotas * 100) / 100 !== 100) {
      e.cuotas = `Las cuotas deben sumar 100% (suma actual: ${sumaCuotas}%)`
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function buildPayload(): OrdenCompraCreateInput {
    return {
      entidadProductorId: fields.entidadProductorId,
      notaVentaId: fields.notaVentaId,
      fecha: fields.fecha,
      formaPago: fields.formaPago.trim() || undefined,
      condicionPagoTexto: fields.condicionPagoTexto.trim() || undefined,
      monedaId: fields.monedaId,
      facturarAId: fields.facturarAId,
      observaciones: fields.observaciones.trim() || undefined,
      lineas,
      cuotasPago: cuotas.filter((c) => c.porcentaje > 0),
    }
  }

  const createMutation = useMutation({
    mutationFn: (data: OrdenCompraCreateInput) => ordenesCompraService.create(data),
    onSuccess: (res) => {
      toast.success(`Orden de Compra creada — ${res.data.numero}`)
      queryClient.invalidateQueries({ queryKey: ordenesCompraKeys.all })
      router.push(`/dashboard/compras/ordenes/${res.data.id}`)
    },
    onError: (e: Error) => toast.error(e.message || 'Error al crear la Orden de Compra'),
  })

  const updateMutation = useMutation({
    mutationFn: (data: OrdenCompraCreateInput & { estado: EstadoOrdenCompra }) => ordenesCompraService.update(ordenCompraId!, data),
    onSuccess: () => {
      toast.success('Orden de Compra actualizada')
      queryClient.invalidateQueries({ queryKey: ordenesCompraKeys.all })
      queryClient.invalidateQueries({ queryKey: ordenesCompraKeys.detail(ordenCompraId!) })
    },
    onError: (e: Error) => toast.error(e.message || 'Error al actualizar la Orden de Compra'),
  })

  function handleSubmit() {
    if (!validate()) {
      toast.error('Hay campos por corregir')
      return
    }
    const payload = buildPayload()
    if (isEdit) updateMutation.mutate({ ...payload, estado: fields.estado })
    else createMutation.mutate(payload)
  }

  if (isEdit && isLoading) {
    return <p className='text-sm text-muted-foreground'>Cargando…</p>
  }

  const isPending = createMutation.isPending || updateMutation.isPending
  const yaRecepcionada = ordenCompra?.data.estado === 'RECEPCIONADA'
  const soloLectura = !puedeEscribir || yaRecepcionada

  return (
    <div className='space-y-6'>
      {soloLectura && (
        <Badge variant='secondary'>
          {yaRecepcionada ? 'Recepcionada — no editable' : 'Solo lectura — sin permiso de edición'}
        </Badge>
      )}
      <fieldset disabled={soloLectura} className='m-0 space-y-6 border-0 p-0'>
      <Card>
        <CardHeader>
          <CardTitle>{isEdit ? `Orden de Compra ${ordenCompra?.data.numero}` : 'Nueva Orden de Compra'}</CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='grid gap-4 sm:grid-cols-2'>
            <div className='space-y-1.5'>
              <Label>Productor <span className='text-destructive'>*</span></Label>
              <Select value={fields.entidadProductorId ? String(fields.entidadProductorId) : ''} onValueChange={(v) => setFields((f) => ({ ...f, entidadProductorId: Number(v) }))}>
                <SelectTrigger><SelectValue placeholder='Seleccionar productor...' /></SelectTrigger>
                <SelectContent>
                  {productores.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.descripcion} — {p.razonSocial}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.entidadProductorId && <p className='text-xs text-destructive'>{errors.entidadProductorId}</p>}
            </div>
            <div className='space-y-1.5'>
              <Label>Fecha</Label>
              <Input type='date' value={fields.fecha} onChange={(e) => setFields((f) => ({ ...f, fecha: e.target.value }))} />
            </div>

            <div className='space-y-1.5'>
              <Label>Cierre Comercial (Nota de Venta)</Label>
              <Select value={fields.notaVentaId ? String(fields.notaVentaId) : '__none__'} onValueChange={(v) => setFields((f) => ({ ...f, notaVentaId: v === '__none__' ? null : Number(v) }))}>
                <SelectTrigger><SelectValue placeholder='Sin Cierre — OC suelta' /></SelectTrigger>
                <SelectContent>
                  <SelectItem value='__none__'>Sin Cierre — OC suelta</SelectItem>
                  {(notasVentaData?.data ?? []).map((nv) => (
                    <SelectItem key={nv.id} value={String(nv.id)}>Folio {nv.folio}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className='space-y-1.5'>
              <Label>Moneda <span className='text-destructive'>*</span></Label>
              <Select value={fields.monedaId ? String(fields.monedaId) : ''} onValueChange={(v) => setFields((f) => ({ ...f, monedaId: Number(v) }))}>
                <SelectTrigger><SelectValue placeholder='Seleccionar...' /></SelectTrigger>
                <SelectContent>
                  {(monedasData?.data ?? []).map((m) => (
                    <SelectItem key={m.id} value={String(m.id)}>{m.codigo} — {m.descripcion}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.monedaId && <p className='text-xs text-destructive'>{errors.monedaId}</p>}
            </div>

            <div className='space-y-1.5'>
              <Label>Forma de Pago</Label>
              <Input value={fields.formaPago} onChange={(e) => setFields((f) => ({ ...f, formaPago: e.target.value }))} placeholder='Ej. Transferencia Bancaria' />
            </div>
            <div className='space-y-1.5'>
              <Label>Facturar a</Label>
              <Select value={fields.facturarAId ? String(fields.facturarAId) : '__none__'} onValueChange={(v) => setFields((f) => ({ ...f, facturarAId: v === '__none__' ? null : Number(v) }))}>
                <SelectTrigger><SelectValue placeholder='Sin definir' /></SelectTrigger>
                <SelectContent>
                  <SelectItem value='__none__'>Sin definir</SelectItem>
                  {entidades.map((e) => (
                    <SelectItem key={e.id} value={String(e.id)}>{e.descripcion}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isEdit && (
              <div className='space-y-1.5'>
                <Label>Estado</Label>
                <Select value={fields.estado} onValueChange={(v) => setFields((f) => ({ ...f, estado: v as EstadoOrdenCompra }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {/* RECEPCIONADA no es una transición manual (OC-001): la
                        asigna el futuro flujo de Recepción de Stock. */}
                    {(['BORRADOR', 'EMITIDA'] as const).map((value) => (
                      <SelectItem key={value} value={value}>{ESTADO_OC_LABELS[value]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className='space-y-1.5'>
            <Label>Condición de Pago (texto explicativo)</Label>
            <Textarea value={fields.condicionPagoTexto} onChange={(e) => setFields((f) => ({ ...f, condicionPagoTexto: e.target.value }))} rows={2} placeholder='Ej. Precio final 50% de la utilidad sobre los costos, liquidación 15 días del arribo de la fruta' />
          </div>
          <div className='space-y-1.5'>
            <Label>Observaciones</Label>
            <Textarea value={fields.observaciones} onChange={(e) => setFields((f) => ({ ...f, observaciones: e.target.value }))} rows={2} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cuotas de Pago</CardTitle>
        </CardHeader>
        <CardContent className='space-y-3'>
          {cuotas.map((c, i) => (
            <div key={i} className='flex items-end gap-2'>
              <div className='space-y-1.5'>
                <Label className='text-xs'>Porcentaje</Label>
                <Input type='number' className='w-28' value={c.porcentaje || ''} onChange={(e) => actualizarCuota(i, { porcentaje: Number(e.target.value) })} />
              </div>
              <div className='space-y-1.5'>
                <Label className='text-xs'>Plazo (días)</Label>
                <Input type='number' className='w-28' value={c.plazoDias || ''} onChange={(e) => actualizarCuota(i, { plazoDias: Number(e.target.value) })} />
              </div>
              <div className='flex-1 space-y-1.5'>
                <Label className='text-xs'>Descripción</Label>
                <Input value={c.descripcion ?? ''} onChange={(e) => actualizarCuota(i, { descripcion: e.target.value })} placeholder='Ej. Anticipo 1 semana después de embarque' />
              </div>
              <Button type='button' variant='ghost' size='icon' onClick={() => quitarCuota(i)}>
                <Icons.trash className='h-4 w-4' />
              </Button>
            </div>
          ))}
          {errors.cuotas && <p className='text-xs text-destructive'>{errors.cuotas}</p>}
          <Button type='button' variant='secondary' size='sm' onClick={agregarCuota}>
            <Icons.add className='mr-1 h-4 w-4' /> Agregar cuota
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Detalle de fruta</CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          {errors.lineas && <p className='text-xs text-destructive'>{errors.lineas}</p>}
          {lineas.map((linea, i) => (
            <LineaOrdenCompra
              key={i}
              linea={linea}
              index={i}
              especies={especies}
              articulos={articulos}
              variedadesService={variedadesService}
              categoriasService={categoriasService}
              calibresService={calibresService}
              onChange={(cambios) => actualizarLinea(i, cambios)}
              onRemove={() => quitarLinea(i)}
              error={errors[`linea-${i}`] ?? errors[`linea-${i}-cant`]}
              puedeQuitar={lineas.length > 1}
            />
          ))}
          <Button type='button' variant='secondary' size='sm' onClick={agregarLinea}>
            <Icons.add className='mr-1 h-4 w-4' /> Agregar línea
          </Button>
        </CardContent>
      </Card>

      </fieldset>

      <div className='flex justify-end gap-2'>
        <Button type='button' variant='outline' onClick={() => router.push('/dashboard/compras/ordenes')} disabled={isPending}>
          {soloLectura ? 'Volver' : 'Cancelar'}
        </Button>
        {!soloLectura && (
          <Button type='button' onClick={handleSubmit} isLoading={isPending}>
            <Icons.check className='mr-1 h-4 w-4' /> {isEdit ? 'Guardar cambios' : 'Crear Orden de Compra'}
          </Button>
        )}
      </div>
    </div>
  )
}

interface LineaOrdenCompraProps {
  linea: OrdenCompraLineaInput
  index: number
  especies: { id: number; descripcion: string }[]
  articulos: { id: number; codigo: string; descripcion: string }[]
  variedadesService: ReturnType<typeof createMantenedorService>
  categoriasService: ReturnType<typeof createMantenedorService>
  calibresService: ReturnType<typeof createMantenedorService>
  onChange: (cambios: Partial<OrdenCompraLineaInput>) => void
  onRemove: () => void
  error?: string
  puedeQuitar: boolean
}

function LineaOrdenCompra({ linea, index, especies, articulos, variedadesService, categoriasService, calibresService, onChange, onRemove, error, puedeQuitar }: LineaOrdenCompraProps) {
  const { data: variedadesData } = useQuery({ queryKey: ['variedades-options', linea.especieId], queryFn: () => variedadesService.list({ limit: 200, especieId: linea.especieId }), staleTime: 60_000, enabled: !!linea.especieId })
  const { data: categoriasData } = useQuery({ queryKey: ['categorias-options', linea.especieId], queryFn: () => categoriasService.list({ limit: 200, especieId: linea.especieId }), staleTime: 60_000, enabled: !!linea.especieId })
  const { data: calibresData } = useQuery({ queryKey: ['calibres-options', linea.especieId], queryFn: () => calibresService.list({ limit: 200, especieId: linea.especieId }), staleTime: 60_000, enabled: !!linea.especieId })

  const articuloSeleccionado = articulos.find((a) => a.id === linea.articuloId) as { etiqueta?: string | null; kgNetoEnvase?: string | null; kgBrutoEnvase?: string | null } | undefined

  return (
    <div className='space-y-2 rounded-md border p-3'>
      <div className='flex items-center justify-between'>
        <p className='text-sm font-medium'>Línea {index + 1}</p>
        {puedeQuitar && (
          <Button type='button' variant='ghost' size='icon' className='h-7 w-7' onClick={onRemove}>
            <Icons.trash className='h-4 w-4' />
          </Button>
        )}
      </div>
      <div className='grid gap-3 sm:grid-cols-2 md:grid-cols-4'>
        <div className='space-y-1.5'>
          <Label className='text-xs'>Especie</Label>
          <Select value={linea.especieId ? String(linea.especieId) : ''} onValueChange={(v) => onChange({ especieId: Number(v), variedadId: 0, categoriaId: 0, calibreMinId: 0, calibreMaxId: 0 })}>
            <SelectTrigger><SelectValue placeholder='Seleccionar...' /></SelectTrigger>
            <SelectContent>
              {especies.map((e) => (
                <SelectItem key={e.id} value={String(e.id)}>{e.descripcion}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className='space-y-1.5'>
          <Label className='text-xs'>Variedad</Label>
          <Select value={linea.variedadId ? String(linea.variedadId) : ''} onValueChange={(v) => onChange({ variedadId: Number(v) })} disabled={!linea.especieId}>
            <SelectTrigger><SelectValue placeholder='Seleccionar...' /></SelectTrigger>
            <SelectContent>
              {(variedadesData?.data ?? []).map((v) => (
                <SelectItem key={v.id} value={String(v.id)}>{v.descripcion}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className='space-y-1.5'>
          <Label className='text-xs'>Categoría</Label>
          <Select value={linea.categoriaId ? String(linea.categoriaId) : ''} onValueChange={(v) => onChange({ categoriaId: Number(v) })} disabled={!linea.especieId}>
            <SelectTrigger><SelectValue placeholder='Seleccionar...' /></SelectTrigger>
            <SelectContent>
              {(categoriasData?.data ?? []).map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>{c.descripcion}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className='space-y-1.5'>
          <Label className='text-xs'>Artículo (Embalaje)</Label>
          <Select value={linea.articuloId ? String(linea.articuloId) : ''} onValueChange={(v) => onChange({ articuloId: Number(v) })}>
            <SelectTrigger><SelectValue placeholder='Seleccionar...' /></SelectTrigger>
            <SelectContent>
              {articulos.map((a) => (
                <SelectItem key={a.id} value={String(a.id)}>{a.codigo} — {a.descripcion}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className='space-y-1.5'>
          <Label className='text-xs'>Calibre Mínimo</Label>
          <Select value={linea.calibreMinId ? String(linea.calibreMinId) : ''} onValueChange={(v) => onChange({ calibreMinId: Number(v) })} disabled={!linea.especieId}>
            <SelectTrigger><SelectValue placeholder='Seleccionar...' /></SelectTrigger>
            <SelectContent>
              {(calibresData?.data ?? []).map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>{c.descripcion}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className='space-y-1.5'>
          <Label className='text-xs'>Calibre Máximo</Label>
          <Select value={linea.calibreMaxId ? String(linea.calibreMaxId) : ''} onValueChange={(v) => onChange({ calibreMaxId: Number(v) })} disabled={!linea.especieId}>
            <SelectTrigger><SelectValue placeholder='Seleccionar...' /></SelectTrigger>
            <SelectContent>
              {(calibresData?.data ?? []).map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>{c.descripcion}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className='space-y-1.5'>
          <Label className='text-xs'>Cant. Pallets</Label>
          <Input type='number' value={linea.cantidadPallets || ''} onChange={(e) => onChange({ cantidadPallets: Number(e.target.value) })} />
        </div>
        <div className='space-y-1.5'>
          <Label className='text-xs'>Cajas x Pallet</Label>
          <Input type='number' value={linea.cajasPorPallet || ''} onChange={(e) => onChange({ cajasPorPallet: Number(e.target.value) })} />
        </div>
        <div className='space-y-1.5'>
          <Label className='text-xs'>Precio USD/Caja</Label>
          <Input type='number' step='0.01' value={linea.precioUsdCaja || ''} onChange={(e) => onChange({ precioUsdCaja: Number(e.target.value) })} />
        </div>
      </div>
      {articuloSeleccionado && (articuloSeleccionado.etiqueta || articuloSeleccionado.kgNetoEnvase) && (
        <p className='text-xs text-muted-foreground'>
          Etiqueta: {articuloSeleccionado.etiqueta ?? '—'} · Kg Neto: {articuloSeleccionado.kgNetoEnvase ?? '—'} · Kg Bruto: {articuloSeleccionado.kgBrutoEnvase ?? '—'}
        </p>
      )}
      {error && <p className='text-xs text-destructive'>{error}</p>}
      <Separator className='mt-2' />
      <p className='text-right text-sm text-muted-foreground'>
        Total: {((linea.cantidadPallets || 0) * (linea.cajasPorPallet || 0))} cajas × ${linea.precioUsdCaja || 0} = ${((linea.cantidadPallets || 0) * (linea.cajasPorPallet || 0) * (linea.precioUsdCaja || 0)).toFixed(2)}
      </p>
    </div>
  )
}
