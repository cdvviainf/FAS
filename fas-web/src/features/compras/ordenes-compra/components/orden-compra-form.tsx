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
import { SelectMultiple } from '@/components/shared/select-multiple'
import { usePuedeEscribir } from '@/hooks/use-item-acceso'
import { createMantenedorService } from '@/features/mantenedor-simple/service'
import { entidadesService } from '@/features/entidades/service'
import { articulosService } from '@/features/materiales/articulos/service'
import { notasVentaService } from '@/features/ventas/notas-venta/service'
import { solicitudesService } from '@/features/solicitudes-inspeccion/service'
import { ESTADO_LABELS } from '@/features/solicitudes-inspeccion/types'
import { usuariosService } from '@/features/usuarios/service'
import { condicionesPagoService } from '@/features/condiciones-pago/service'
import { FECHA_REFERENCIA_LABELS } from '@/features/condiciones-pago/types'
import { ordenCompraDetailOptions, ordenesCompraKeys } from '../queries'
import { ordenesCompraService } from '../service'
import type {
  OrdenCompraCreateInput,
  OrdenCompraLineaInput,
  OrdenCompraLineaItem,
  EstadoOrdenCompra,
} from '../types'
import { ESTADO_OC_LABELS } from '../types'

const monedasService = createMantenedorService('monedas')
const especiesService = createMantenedorService('especies')
const variedadesService = createMantenedorService('variedades')
const categoriasService = createMantenedorService('categorias')
const calibresService = createMantenedorService('calibres')
const tiposPalletService = createMantenedorService('tipos-pallet')
const formasPagoService = createMantenedorService('formas-pago')
const mercadosService = createMantenedorService('mercados')
const tiposParametroService = createMantenedorService('tipos-parametro')
const parametrosService = createMantenedorService('parametros')

// Cajas por pallet aún no tiene mantenedor propio (pendiente de desarrollar).
// Mientras tanto se asume un valor fijo, usado para precalcular "Cantidad de
// Cajas" y que el usuario puede sobrescribir manualmente (mismo criterio que
// nota-venta-form.tsx).
const CAJAS_POR_PALLET_DEFAULT = 108

type Origen = 'CIERRE' | 'MANUAL'

interface HeaderFields {
  origen: Origen
  entidadProductorId: number
  notaVentaId: number | null
  solicitudInspeccionIds: number[]
  fecha: string
  responsableId: string | null
  destinoMercadoId: number | null
  condicionPagoId: number | null
  formaPagoId: number | null
  incotermId: number | null
  monedaId: number
  observaciones: string
  estado: EstadoOrdenCompra
}

const HEADER_EMPTY: HeaderFields = {
  origen: 'MANUAL',
  entidadProductorId: 0,
  notaVentaId: null,
  solicitudInspeccionIds: [],
  fecha: new Date().toISOString().slice(0, 10),
  responsableId: null,
  destinoMercadoId: null,
  condicionPagoId: null,
  formaPagoId: null,
  incotermId: null,
  monedaId: 0,
  observaciones: '',
  estado: 'BORRADOR',
}

const LINEA_EMPTY: OrdenCompraLineaInput = {
  especieId: 0,
  variedadId: 0,
  categoriaId: 0,
  articuloId: 0,
  calibreIds: [],
  tipoPalletId: null,
  cantidadPallets: 0,
  cajasPorPallet: CAJAS_POR_PALLET_DEFAULT,
  cajas: 0,
  precioUsdCaja: 0,
}

interface OrdenCompraFormProps {
  ordenCompraId?: number
}

const ITEM = 'COMPRAS_OC'

export function OrdenCompraForm({ ordenCompraId }: OrdenCompraFormProps) {
  const isEdit = !!ordenCompraId
  const router = useRouter()
  const queryClient = useQueryClient()
  const puedeEscribir = usePuedeEscribir(ITEM)

  const [fields, setFields] = useState<HeaderFields>(HEADER_EMPTY)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [linea, setLinea] = useState<OrdenCompraLineaInput>(LINEA_EMPTY)
  const [lineaErrors, setLineaErrors] = useState<Record<string, string>>({})
  const [editingLineaId, setEditingLineaId] = useState<number | null>(null)
  const [deleteLineaId, setDeleteLineaId] = useState<number | null>(null)
  const [calibreDesdeId, setCalibreDesdeId] = useState<number | null>(null)
  const [calibreHastaId, setCalibreHastaId] = useState<number | null>(null)

  const { data: ordenCompra, isLoading } = useQuery({
    ...ordenCompraDetailOptions(ordenCompraId ?? 0),
    enabled: isEdit,
  })

  const { data: productoresData } = useQuery({
    queryKey: ['entidades-productores-options'],
    queryFn: () => entidadesService.list({ tipo: 'PRODUCTOR', limit: 500, activo: true }),
    staleTime: 60_000,
  })
  const { data: notasVentaData } = useQuery({
    queryKey: ['notas-venta-options'],
    queryFn: () => notasVentaService.list({ limit: 200 }),
    staleTime: 60_000,
    enabled: fields.origen === 'CIERRE',
  })
  const { data: responsablesData } = useQuery({
    queryKey: ['usuarios-responsables-venta-options'],
    queryFn: () => usuariosService.list({ limit: 500, esResponsableVenta: true }),
    staleTime: 60_000,
  })
  // N:M (2026-08-22, Etapa 2, FAS-OCSI-002): se listan TODAS las solicitudes
  // (no solo Aprobadas) — el backend solo exige que al menos una del
  // conjunto esté Aprobada, las demás pueden estar en cualquier estado.
  const { data: solicitudesInspeccionData } = useQuery({
    queryKey: ['solicitudes-inspeccion-compra-options'],
    queryFn: () => solicitudesService.list({ limit: 500 }),
    staleTime: 60_000,
  })
  const { data: mercadosData } = useQuery({ queryKey: ['mercados-options'], queryFn: () => mercadosService.list({ limit: 500 }), staleTime: 5 * 60_000 })
  const { data: condicionesPagoData } = useQuery({
    queryKey: ['condiciones-pago-options', 'COMPRA'],
    queryFn: () => condicionesPagoService.list({ tipo: 'COMPRA' }),
    staleTime: 60_000,
  })
  const { data: formasPagoData } = useQuery({ queryKey: ['formas-pago-options'], queryFn: () => formasPagoService.list({ limit: 200, soloActivos: true }), staleTime: 5 * 60_000 })
  const { data: monedasData } = useQuery({ queryKey: ['monedas-options'], queryFn: () => monedasService.list({ limit: 200 }), staleTime: 5 * 60_000 })
  const { data: especiesData } = useQuery({ queryKey: ['especies-options'], queryFn: () => especiesService.list({ limit: 200 }), staleTime: 5 * 60_000 })
  const { data: articulosData } = useQuery({ queryKey: ['articulos-embalaje-options'], queryFn: () => articulosService.list({ limit: 500, tipo: 'EMBALAJE', activo: true }), staleTime: 60_000 })
  const { data: variedadesData } = useQuery({ queryKey: ['variedades-options', linea.especieId], queryFn: () => variedadesService.list({ limit: 200, especieId: linea.especieId }), staleTime: 60_000, enabled: !!linea.especieId })
  const { data: categoriasData } = useQuery({ queryKey: ['categorias-options', linea.especieId], queryFn: () => categoriasService.list({ limit: 200, especieId: linea.especieId }), staleTime: 60_000, enabled: !!linea.especieId })
  const { data: calibresData } = useQuery({ queryKey: ['calibres-options', linea.especieId], queryFn: () => calibresService.list({ limit: 200, especieId: linea.especieId }), staleTime: 60_000, enabled: !!linea.especieId })
  const { data: tiposPalletData } = useQuery({ queryKey: ['tipos-pallet-options'], queryFn: () => tiposPalletService.list({ limit: 200 }), staleTime: 5 * 60_000 })

  // Incoterm: catálogo genérico Parametro (TipoParametro INCOTERM), mismo
  // mecanismo ya usado por Cierre Comercial (nota-venta-form.tsx).
  const { data: tiposParametroData } = useQuery({ queryKey: ['tipos-parametro-options'], queryFn: () => tiposParametroService.list({ limit: 200 }), staleTime: 5 * 60_000 })
  const incotermTipoId = tiposParametroData?.data.find((t) => t.codigo === 'INCOTERM')?.id
  const { data: incotermsData } = useQuery({ queryKey: ['parametros-options', incotermTipoId], queryFn: () => parametrosService.list({ limit: 200, tipoParametroId: incotermTipoId }), staleTime: 5 * 60_000, enabled: !!incotermTipoId })

  const productores = productoresData?.data ?? []
  const responsables = responsablesData?.data ?? []
  const especies = especiesData?.data ?? []
  const articulos = articulosData?.data ?? []
  // Filtradas al productor elegido: una inspección de compra corresponde a un
  // productor específico (validado también en el backend).
  const solicitudesInspeccion = (solicitudesInspeccionData?.data ?? []).filter(
    (s) => !fields.entidadProductorId || s.entidadProductorId === fields.entidadProductorId,
  )

  // Cuotas que se derivarán automáticamente al guardar (según Condición de Pago
  // seleccionada) — solo lectura, no se cargan manualmente.
  const condicionPagoSeleccionada = (condicionesPagoData?.data ?? []).find((c) => c.id === fields.condicionPagoId)
  const cuotasPreview = isEdit ? ordenCompra?.data.cuotasPago ?? [] : condicionPagoSeleccionada?.cuotas ?? []

  useEffect(() => {
    if (ordenCompra) {
      const d = ordenCompra.data
      setFields({
        origen: d.notaVentaId ? 'CIERRE' : 'MANUAL',
        entidadProductorId: d.entidadProductorId,
        notaVentaId: d.notaVentaId,
        solicitudInspeccionIds: d.solicitudes.map((s) => s.solicitudInspeccion.id),
        fecha: d.fecha.slice(0, 10),
        responsableId: d.responsableId,
        destinoMercadoId: d.destinoMercadoId,
        condicionPagoId: d.condicionPagoId,
        formaPagoId: d.formaPagoId,
        incotermId: d.incotermId,
        monedaId: d.monedaId,
        observaciones: d.observaciones ?? '',
        estado: d.estado,
      })
    }
  }, [ordenCompra])

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!fields.entidadProductorId) e.entidadProductorId = 'El productor es requerido'
    if (!fields.monedaId) e.monedaId = 'La moneda es requerida'
    if (fields.origen === 'CIERRE' && !fields.notaVentaId) e.notaVentaId = 'Selecciona el Cierre Comercial'
    // Siempre requerida, también al editar (FAS-OCSI-006, QA ronda 4): si se
    // permitiera vaciar solo en create, buildPayload() convierte el arreglo
    // vacío en `undefined` y el backend interpreta "campo ausente" como "no
    // tocar" — el PATCH "éxito" no cambiaría nada y el usuario no se entera.
    if (fields.solicitudInspeccionIds.length === 0) e.solicitudInspeccionIds = 'La inspección de compra es requerida'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function buildPayload(): OrdenCompraCreateInput {
    return {
      entidadProductorId: fields.entidadProductorId,
      notaVentaId: fields.origen === 'CIERRE' ? fields.notaVentaId : null,
      solicitudInspeccionIds: fields.solicitudInspeccionIds.length > 0 ? fields.solicitudInspeccionIds : undefined,
      fecha: fields.fecha,
      responsableId: fields.responsableId,
      destinoMercadoId: fields.destinoMercadoId,
      condicionPagoId: fields.condicionPagoId,
      formaPagoId: fields.formaPagoId,
      incotermId: fields.incotermId,
      monedaId: fields.monedaId,
      observaciones: fields.observaciones.trim() || undefined,
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

  const addLineaMutation = useMutation({
    mutationFn: (data: OrdenCompraLineaInput) => ordenesCompraService.addLinea(ordenCompraId!, data),
    onSuccess: () => {
      toast.success('Línea agregada')
      setLinea(LINEA_EMPTY)
      setLineaErrors({})
      resetCalibreRango()
      queryClient.invalidateQueries({ queryKey: ordenesCompraKeys.detail(ordenCompraId!) })
    },
    onError: (e: Error) => toast.error(e.message || 'Error al agregar la línea'),
  })

  const updateLineaMutation = useMutation({
    mutationFn: (data: OrdenCompraLineaInput) => ordenesCompraService.updateLinea(ordenCompraId!, editingLineaId!, data),
    onSuccess: () => {
      toast.success('Línea actualizada')
      setLinea(LINEA_EMPTY)
      setLineaErrors({})
      setEditingLineaId(null)
      resetCalibreRango()
      queryClient.invalidateQueries({ queryKey: ordenesCompraKeys.detail(ordenCompraId!) })
    },
    onError: (e: Error) => toast.error(e.message || 'Error al actualizar la línea'),
  })

  const removeLineaMutation = useMutation({
    mutationFn: (lineaId: number) => ordenesCompraService.removeLinea(ordenCompraId!, lineaId),
    onSuccess: () => {
      toast.success('Línea eliminada')
      setDeleteLineaId(null)
      queryClient.invalidateQueries({ queryKey: ordenesCompraKeys.detail(ordenCompraId!) })
    },
    onError: (e: Error) => toast.error(e.message || 'Error al eliminar la línea'),
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

  function validarLinea(): boolean {
    const e: Record<string, string> = {}
    if (!linea.especieId) e.especieId = 'Requerida'
    if (!linea.variedadId) e.variedadId = 'Requerida'
    if (!linea.categoriaId) e.categoriaId = 'Requerida'
    if (!linea.articuloId) e.articuloId = 'Requerido'
    if (linea.calibreIds.length === 0) e.calibreIds = 'Selecciona al menos un calibre'
    if (!linea.cantidadPallets || linea.cantidadPallets <= 0) e.cantidadPallets = 'Debe ser mayor a 0'
    if (!linea.cajas || linea.cajas <= 0) e.cajas = 'Debe ser mayor a 0'
    if (linea.precioUsdCaja < 0) e.precioUsdCaja = 'No puede ser negativo'
    setLineaErrors(e)
    return Object.keys(e).length === 0
  }

  function handleGuardarLinea() {
    if (!validarLinea()) return
    if (editingLineaId) updateLineaMutation.mutate(linea)
    else addLineaMutation.mutate(linea)
  }

  function handleEditarLinea(l: OrdenCompraLineaItem) {
    setEditingLineaId(l.id)
    setLinea({
      especieId: l.especieId,
      variedadId: l.variedadId,
      categoriaId: l.categoriaId,
      articuloId: l.articuloId,
      calibreIds: l.calibres.map((c) => c.calibre.id),
      tipoPalletId: l.tipoPalletId,
      cantidadPallets: l.cantidadPallets,
      cajasPorPallet: l.cajasPorPallet,
      cajas: l.cajas,
      precioUsdCaja: Number(l.precioUsdCaja),
    })
    setLineaErrors({})
    resetCalibreRango()
  }

  function handleCancelarEdicionLinea() {
    setEditingLineaId(null)
    setLinea(LINEA_EMPTY)
    setLineaErrors({})
    resetCalibreRango()
  }

  function resetCalibreRango() {
    setCalibreDesdeId(null)
    setCalibreHastaId(null)
  }

  function agregarRangoCalibre() {
    if (!calibreDesdeId) return
    const lista = calibresData?.data ?? []
    const hastaId = calibreHastaId ?? calibreDesdeId
    const idxDesde = lista.findIndex((c) => c.id === calibreDesdeId)
    const idxHasta = lista.findIndex((c) => c.id === hastaId)
    if (idxDesde === -1 || idxHasta === -1) return
    const [ini, fin] = idxDesde <= idxHasta ? [idxDesde, idxHasta] : [idxHasta, idxDesde]
    const nuevos = lista.slice(ini, fin + 1).map((c) => c.id)
    setLinea((l) => ({ ...l, calibreIds: Array.from(new Set([...l.calibreIds, ...nuevos])) }))
    resetCalibreRango()
  }

  if (isEdit && isLoading) {
    return <p className='text-sm text-muted-foreground'>Cargando…</p>
  }

  const isPending = createMutation.isPending || updateMutation.isPending
  const yaRecepcionada = ordenCompra?.data.estado === 'RECEPCIONADA'
  const soloLectura = !puedeEscribir || yaRecepcionada
  const articuloSeleccionado = articulos.find((a) => a.id === linea.articuloId) as { etiqueta?: { descripcion: string } | null; kgNetoEnvase?: string | null; kgBrutoEnvase?: string | null } | undefined
  const lineaMutationPending = addLineaMutation.isPending || updateLineaMutation.isPending

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
          {/* Fila 1: Origen + Cierre Comercial (si aplica) + Fecha */}
          <div className={`grid gap-4 sm:grid-cols-2 ${fields.origen === 'CIERRE' ? 'md:grid-cols-3' : ''}`}>
            <div className='space-y-1.5'>
              <Label>Origen</Label>
              <Select value={fields.origen} onValueChange={(v) => setFields((f) => ({ ...f, origen: v as Origen, notaVentaId: v === 'MANUAL' ? null : f.notaVentaId }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value='CIERRE'>Cierre Comercial</SelectItem>
                  <SelectItem value='MANUAL'>Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {fields.origen === 'CIERRE' && (
              <div className='space-y-1.5'>
                <Label>Cierre Comercial</Label>
                <Select value={fields.notaVentaId ? String(fields.notaVentaId) : ''} onValueChange={(v) => setFields((f) => ({ ...f, notaVentaId: Number(v) }))}>
                  <SelectTrigger><SelectValue placeholder='Seleccionar...' /></SelectTrigger>
                  <SelectContent>
                    {(notasVentaData?.data ?? []).map((nv) => (
                      <SelectItem key={nv.id} value={String(nv.id)}>Folio {nv.folio}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.notaVentaId && <p className='text-xs text-destructive'>{errors.notaVentaId}</p>}
              </div>
            )}
            <div className='space-y-1.5'>
              <Label>Fecha</Label>
              <Input type='date' value={fields.fecha} onChange={(e) => setFields((f) => ({ ...f, fecha: e.target.value }))} />
            </div>
          </div>

          <Separator />

          {/* Fila 2: Productor + Responsable + Destino */}
          <div className='grid gap-4 sm:grid-cols-3'>
            <div className='space-y-1.5'>
              <Label>Productor <span className='text-destructive'>*</span></Label>
              <Combobox
                value={fields.entidadProductorId ? String(fields.entidadProductorId) : ''}
                onChange={(v) => setFields((f) => ({ ...f, entidadProductorId: Number(v), solicitudInspeccionIds: [] }))}
                placeholder='Seleccionar productor...'
                searchPlaceholder='Buscar productor...'
                options={productores.map((p) => ({ value: String(p.id), label: `${p.descripcion} — ${p.razonSocial}` }))}
              />
              {errors.entidadProductorId && <p className='text-xs text-destructive'>{errors.entidadProductorId}</p>}
            </div>
            <div className='space-y-1.5'>
              <Label>Responsable</Label>
              <Select value={fields.responsableId ?? '__none__'} onValueChange={(v) => setFields((f) => ({ ...f, responsableId: v === '__none__' ? null : v }))}>
                <SelectTrigger><SelectValue placeholder='Sin definir' /></SelectTrigger>
                <SelectContent>
                  <SelectItem value='__none__'>Sin definir</SelectItem>
                  {responsables.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className='space-y-1.5'>
              <Label>Destino</Label>
              <Select value={fields.destinoMercadoId ? String(fields.destinoMercadoId) : '__none__'} onValueChange={(v) => setFields((f) => ({ ...f, destinoMercadoId: v === '__none__' ? null : Number(v) }))}>
                <SelectTrigger><SelectValue placeholder='Sin definir' /></SelectTrigger>
                <SelectContent>
                  <SelectItem value='__none__'>Sin definir</SelectItem>
                  {(mercadosData?.data ?? []).map((m) => (
                    <SelectItem key={m.id} value={String(m.id)}>{m.descripcion}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Fila 2b: Inspección de Compra — N:M (Etapa 2): una OC puede tener
              varias; todas del mismo productor y al menos una Aprobada. */}
          <div className='grid gap-4 sm:grid-cols-3'>
            <div className='space-y-1.5'>
              <Label>Inspección de Compra <span className='text-destructive'>*</span></Label>
              <SelectMultiple
                options={solicitudesInspeccion.map((s) => ({ id: s.id, label: `${s.codigo} — ${ESTADO_LABELS[s.estado]}` }))}
                selectedIds={fields.solicitudInspeccionIds}
                onChange={(ids) => setFields((f) => ({ ...f, solicitudInspeccionIds: ids }))}
                placeholder={fields.entidadProductorId ? 'Agregar inspección...' : 'Elige un productor primero'}
                disabled={!fields.entidadProductorId}
              />
              <p className='text-xs text-muted-foreground'>Se listan las inspecciones de Compra del productor seleccionado — al menos una debe estar Aprobada.</p>
              {errors.solicitudInspeccionIds && <p className='text-xs text-destructive'>{errors.solicitudInspeccionIds}</p>}
            </div>
          </div>

          <Separator />

          {/* Fila 3: Condición de pago + Forma de pago + Moneda */}
          <div className='grid gap-4 sm:grid-cols-3'>
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
            </div>
            <div className='space-y-1.5'>
              <Label>Forma de Pago</Label>
              <Select value={fields.formaPagoId ? String(fields.formaPagoId) : '__none__'} onValueChange={(v) => setFields((f) => ({ ...f, formaPagoId: v === '__none__' ? null : Number(v) }))}>
                <SelectTrigger><SelectValue placeholder='Sin definir' /></SelectTrigger>
                <SelectContent>
                  <SelectItem value='__none__'>Sin definir</SelectItem>
                  {(formasPagoData?.data ?? []).map((f) => (
                    <SelectItem key={f.id} value={String(f.id)}>{f.descripcion}</SelectItem>
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
              <Label>Incoterm</Label>
              <Select value={fields.incotermId ? String(fields.incotermId) : '__none__'} onValueChange={(v) => setFields((f) => ({ ...f, incotermId: v === '__none__' ? null : Number(v) }))}>
                <SelectTrigger><SelectValue placeholder='Sin definir' /></SelectTrigger>
                <SelectContent>
                  <SelectItem value='__none__'>Sin definir</SelectItem>
                  {(incotermsData?.data ?? []).map((i) => (
                    <SelectItem key={i.id} value={String(i.id)}>{i.descripcion}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {cuotasPreview.length > 0 && (
            <div className='rounded-md border p-3'>
              <p className='mb-2 text-xs font-medium text-muted-foreground'>Cuotas de pago (determinadas por la Condición de Pago)</p>
              <div className='flex flex-wrap gap-2'>
                {cuotasPreview.map((c, i) => (
                  <Badge key={i} variant='outline'>
                    {c.tipoValor === 'MONTO_UNITARIO'
                      ? `${c.moneda?.codigo ?? ''} ${c.valorUnitario} por ${c.unidad?.descripcion ?? ''}`
                      : `${c.porcentaje}%`} a {c.plazoDias} días desde {FECHA_REFERENCIA_LABELS[c.fechaReferencia]}{c.descripcion ? ` — ${c.descripcion}` : ''}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <Separator />

          {/* Fila 4: Observaciones */}
          <div className='space-y-1.5'>
            <Label>Observaciones</Label>
            <Textarea value={fields.observaciones} onChange={(e) => setFields((f) => ({ ...f, observaciones: e.target.value }))} rows={2} />
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
        </CardContent>
      </Card>

      </fieldset>

      {isEdit && (
        <fieldset disabled={soloLectura} className='m-0 space-y-6 border-0 p-0'>
        <Card>
          <CardHeader>
            <CardTitle>Detalle de fruta</CardTitle>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='space-y-3'>
              {/* Fila 1: Especie, Embalaje (2 columnas) */}
              <div className='grid gap-3 sm:grid-cols-2 md:grid-cols-3'>
                <div className='space-y-1.5'>
                  <Label>Especie <span className='text-destructive'>*</span></Label>
                  <Select value={linea.especieId ? String(linea.especieId) : ''} onValueChange={(v) => { setLinea((l) => ({ ...l, especieId: Number(v), variedadId: 0, categoriaId: 0, calibreIds: [] })); resetCalibreRango() }}>
                    <SelectTrigger><SelectValue placeholder='Seleccionar...' /></SelectTrigger>
                    <SelectContent>
                      {especies.map((e) => (
                        <SelectItem key={e.id} value={String(e.id)}>{e.descripcion}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {lineaErrors.especieId && <p className='text-xs text-destructive'>{lineaErrors.especieId}</p>}
                </div>
                <div className='space-y-1.5 md:col-span-2'>
                  <Label>Embalaje <span className='text-destructive'>*</span></Label>
                  <Select value={linea.articuloId ? String(linea.articuloId) : ''} onValueChange={(v) => setLinea((l) => ({ ...l, articuloId: Number(v) }))}>
                    <SelectTrigger><SelectValue placeholder='Seleccionar...' /></SelectTrigger>
                    <SelectContent>
                      {articulos.map((a) => (
                        <SelectItem key={a.id} value={String(a.id)}>{a.codigo} — {a.descripcion}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {lineaErrors.articuloId && <p className='text-xs text-destructive'>{lineaErrors.articuloId}</p>}
                </div>
              </div>

              {/* Fila 2: Variedad, Categoría */}
              <div className='grid gap-3 sm:grid-cols-2 md:grid-cols-3'>
                <div className='space-y-1.5'>
                  <Label>Variedad <span className='text-destructive'>*</span></Label>
                  <Select value={linea.variedadId ? String(linea.variedadId) : ''} onValueChange={(v) => setLinea((l) => ({ ...l, variedadId: Number(v) }))} disabled={!linea.especieId}>
                    <SelectTrigger><SelectValue placeholder='Seleccionar...' /></SelectTrigger>
                    <SelectContent>
                      {(variedadesData?.data ?? []).map((v) => (
                        <SelectItem key={v.id} value={String(v.id)}>{v.descripcion}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {lineaErrors.variedadId && <p className='text-xs text-destructive'>{lineaErrors.variedadId}</p>}
                </div>
                <div className='space-y-1.5'>
                  <Label>Categoría <span className='text-destructive'>*</span></Label>
                  <Select value={linea.categoriaId ? String(linea.categoriaId) : ''} onValueChange={(v) => setLinea((l) => ({ ...l, categoriaId: Number(v) }))} disabled={!linea.especieId}>
                    <SelectTrigger><SelectValue placeholder='Seleccionar...' /></SelectTrigger>
                    <SelectContent>
                      {(categoriasData?.data ?? []).map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>{c.descripcion}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {lineaErrors.categoriaId && <p className='text-xs text-destructive'>{lineaErrors.categoriaId}</p>}
                </div>
              </div>

              {/* Fila 3: Calibre Inicio, Calibre Fin, Agregar */}
              <div className='grid gap-3 sm:grid-cols-2 md:grid-cols-3'>
                <div className='min-w-0 space-y-1.5'>
                  <Label>Calibre Inicio</Label>
                  <Select value={calibreDesdeId ? String(calibreDesdeId) : ''} onValueChange={(v) => setCalibreDesdeId(Number(v))} disabled={!linea.especieId}>
                    <SelectTrigger><SelectValue placeholder={linea.especieId ? 'Seleccionar...' : 'Elige una especie primero'} /></SelectTrigger>
                    <SelectContent>
                      {(calibresData?.data ?? []).map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>{c.descripcion}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className='min-w-0 space-y-1.5'>
                  <Label>Calibre Fin</Label>
                  <Select value={calibreHastaId ? String(calibreHastaId) : ''} onValueChange={(v) => setCalibreHastaId(Number(v))} disabled={!linea.especieId}>
                    <SelectTrigger><SelectValue placeholder='Igual a inicio' /></SelectTrigger>
                    <SelectContent>
                      {(calibresData?.data ?? []).map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>{c.descripcion}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className='space-y-1.5'>
                  <Label className='invisible'>Agregar</Label>
                  <Button type='button' variant='secondary' className='w-full' onClick={agregarRangoCalibre} disabled={!linea.especieId || !calibreDesdeId}>
                    <Icons.add className='mr-1 h-4 w-4' /> Agregar
                  </Button>
                </div>
              </div>

              <div className='space-y-1.5'>
                <Label>Calibres <span className='text-destructive'>*</span></Label>
                {linea.calibreIds.length > 0 ? (
                  <div className='flex flex-wrap gap-1.5'>
                    {linea.calibreIds.map((id) => {
                      const opt = (calibresData?.data ?? []).find((c) => c.id === id)
                      return (
                        <Badge key={id} variant='secondary' className='gap-1 pr-1'>
                          {opt?.descripcion ?? id}
                          <button
                            type='button'
                            onClick={() => setLinea((l) => ({ ...l, calibreIds: l.calibreIds.filter((x) => x !== id) }))}
                            className='ml-0.5 rounded-sm hover:bg-muted-foreground/20'
                          >
                            <Icons.close className='h-3 w-3' />
                          </button>
                        </Badge>
                      )
                    })}
                  </div>
                ) : (
                  <p className='text-xs text-muted-foreground'>Selecciona Calibre Inicio / Fin arriba y agrega.</p>
                )}
                {lineaErrors.calibreIds && <p className='text-xs text-destructive'>{lineaErrors.calibreIds}</p>}
              </div>

              {/* Fila 4: Tipo Pallet, Cant. Pallets, Cantidad de Cajas */}
              <div className='grid gap-3 sm:grid-cols-2 md:grid-cols-3'>
                <div className='space-y-1.5'>
                  <Label>Tipo Pallet</Label>
                  <Select value={linea.tipoPalletId ? String(linea.tipoPalletId) : '__none__'} onValueChange={(v) => setLinea((l) => ({ ...l, tipoPalletId: v === '__none__' ? null : Number(v) }))}>
                    <SelectTrigger><SelectValue placeholder='Sin definir' /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value='__none__'>Sin definir</SelectItem>
                      {(tiposPalletData?.data ?? []).map((t) => (
                        <SelectItem key={t.id} value={String(t.id)}>{t.descripcion}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className='space-y-1.5'>
                  <Label>Cant. Pallets <span className='text-destructive'>*</span></Label>
                  <Input
                    type='number'
                    value={linea.cantidadPallets || ''}
                    onChange={(e) => {
                      const v = e.target.value
                      const pallets = Number(v)
                      setLinea((l) => ({ ...l, cantidadPallets: pallets, cajas: v ? pallets * CAJAS_POR_PALLET_DEFAULT : l.cajas }))
                    }}
                  />
                  {lineaErrors.cantidadPallets && <p className='text-xs text-destructive'>{lineaErrors.cantidadPallets}</p>}
                </div>
                <div className='space-y-1.5'>
                  <Label>Cantidad de Cajas <span className='text-destructive'>*</span></Label>
                  <Input type='number' value={linea.cajas || ''} onChange={(e) => setLinea((l) => ({ ...l, cajas: Number(e.target.value) }))} />
                  {lineaErrors.cajas && <p className='text-xs text-destructive'>{lineaErrors.cajas}</p>}
                </div>
              </div>

              {/* Fila 5: Valor USD/Caja */}
              <div className='grid gap-3 sm:grid-cols-2 md:grid-cols-3'>
                <div className='space-y-1.5'>
                  <Label>Valor (USD/Caja)</Label>
                  <Input type='number' step='0.01' value={linea.precioUsdCaja || ''} onChange={(e) => setLinea((l) => ({ ...l, precioUsdCaja: Number(e.target.value) }))} />
                  {lineaErrors.precioUsdCaja && <p className='text-xs text-destructive'>{lineaErrors.precioUsdCaja}</p>}
                </div>
              </div>
            </div>

            {articuloSeleccionado && (articuloSeleccionado.etiqueta || articuloSeleccionado.kgNetoEnvase) && (
              <p className='text-xs text-muted-foreground'>
                Etiqueta: {articuloSeleccionado.etiqueta?.descripcion ?? '—'} · Kg Neto: {articuloSeleccionado.kgNetoEnvase ?? '—'} · Kg Bruto: {articuloSeleccionado.kgBrutoEnvase ?? '—'}
              </p>
            )}
            {linea.cajas > 0 && (
              <p className='text-right text-sm text-muted-foreground'>
                Total: {linea.cajas} cajas × ${linea.precioUsdCaja || 0} = ${(linea.cajas * linea.precioUsdCaja).toFixed(2)}
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

            {(ordenCompra?.data.lineas.length ?? 0) > 0 && (
              <>
                <Separator />
                <div className='overflow-x-auto rounded-md border'>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Especie / Variedad</TableHead>
                        <TableHead>Embalaje</TableHead>
                        <TableHead>Categoría</TableHead>
                        <TableHead>Calibre</TableHead>
                        <TableHead>Cantidad</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead className='w-20 text-right'>Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ordenCompra!.data.lineas.map((l) => (
                        <TableRow key={l.id}>
                          <TableCell className='font-medium whitespace-nowrap'>{l.especie.descripcion} / {l.variedad.descripcion}</TableCell>
                          <TableCell className='whitespace-nowrap text-muted-foreground'>{l.articulo.descripcion}</TableCell>
                          <TableCell className='whitespace-nowrap text-muted-foreground'>{l.categoria.descripcion}</TableCell>
                          <TableCell className='max-w-[180px] text-muted-foreground'>
                            <div className='flex flex-wrap gap-1'>
                              {l.calibres.map((c) => (
                                <Badge key={c.calibre.id} variant='outline' className='text-xs'>{c.calibre.codigo}</Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className='whitespace-nowrap text-muted-foreground'>{l.cantidadPallets} pallets · {l.cajas} cajas</TableCell>
                          <TableCell className='whitespace-nowrap text-muted-foreground'>${l.precioUsdCaja}/cj</TableCell>
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
        </fieldset>
      )}

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

