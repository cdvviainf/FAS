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
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Icons } from '@/components/icons'
import { Combobox } from '@/components/ui/combobox'
import { createMantenedorService } from '@/features/mantenedor-simple/service'
import { entidadesService } from '@/features/entidades/service'
import { entidadDetailOptions } from '@/features/entidades/queries'
import { articulosService } from '@/features/materiales/articulos/service'
import { condicionesPagoService } from '@/features/condiciones-pago/service'
import { FECHA_REFERENCIA_LABELS } from '@/features/condiciones-pago/types'
import { notaVentaDetailOptions, notasVentaKeys } from '../queries'
import { notasVentaService } from '../service'
import type { NotaVentaCreateInput, NotaVentaDetalleCreateInput } from '../types'

const tiposEmbarqueService = createMantenedorService('tipos-embarque')
const mercadosService = createMantenedorService('mercados')
const paisesService = createMantenedorService('paises')
const puertosService = createMantenedorService('puertos')
const monedasService = createMantenedorService('monedas')
const especiesService = createMantenedorService('especies')
const variedadesService = createMantenedorService('variedades')
const categoriasService = createMantenedorService('categorias')
const calibresService = createMantenedorService('calibres')
const tiposPalletService = createMantenedorService('tipos-pallet')
const tiposParametroService = createMantenedorService('tipos-parametro')
const parametrosService = createMantenedorService('parametros')

interface HeaderFields {
  fecha: string
  clienteId: number
  compradorId: number | null
  notifyId: number | null
  clienteFinalId: number | null
  tipoEmbarqueId: number
  mercadoId: number
  paisDestinoId: number
  puertoDestinoId: number | null
  direccionId: number | null
  direccionDetalle: string
  monedaId: number
  modalidadVentaId: number | null
  clausulaVentaId: number | null
  tipoFleteId: number | null
  condicionPagoId: number | null
  observaciones: string
}

const HEADER_EMPTY: HeaderFields = {
  fecha: new Date().toISOString().slice(0, 10),
  clienteId: 0,
  compradorId: null,
  notifyId: null,
  clienteFinalId: null,
  tipoEmbarqueId: 0,
  mercadoId: 0,
  paisDestinoId: 0,
  puertoDestinoId: null,
  direccionId: null,
  direccionDetalle: '',
  monedaId: 0,
  modalidadVentaId: null,
  clausulaVentaId: null,
  tipoFleteId: null,
  condicionPagoId: null,
  observaciones: '',
}

interface NuevaLinea {
  fechaCompromiso: string
  especieId: number
  variedadId: number
  articuloId: number
  categoriaId: number | null
  tipoPalletId: number | null
  cantidadPallets: string
  cajasPorPallet: string
  cajas: string
  precio: string
  calibreInicioId: number
  calibreFinId: number
}

const LINEA_EMPTY: NuevaLinea = {
  fechaCompromiso: '',
  especieId: 0,
  variedadId: 0,
  articuloId: 0,
  categoriaId: null,
  tipoPalletId: null,
  cantidadPallets: '',
  cajasPorPallet: '',
  cajas: '',
  precio: '',
  calibreInicioId: 0,
  calibreFinId: 0,
}

interface NotaVentaFormProps {
  notaVentaId?: number
}

export function NotaVentaForm({ notaVentaId }: NotaVentaFormProps) {
  const isEdit = !!notaVentaId
  const router = useRouter()
  const queryClient = useQueryClient()

  const [fields, setFields] = useState<HeaderFields>(HEADER_EMPTY)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [linea, setLinea] = useState<NuevaLinea>(LINEA_EMPTY)
  const [lineaErrors, setLineaErrors] = useState<Record<string, string>>({})

  const { data: notaVenta, isLoading } = useQuery({
    ...notaVentaDetailOptions(notaVentaId ?? 0),
    enabled: isEdit,
  })

  const { data: clientesData } = useQuery({
    queryKey: ['entidades-clientes-options'],
    queryFn: () => entidadesService.list({ limit: 500, activo: true }),
    staleTime: 60_000,
  })
  const clientes = (clientesData?.data ?? []).filter(
    (e) => e.tipos.includes('CLIENTE_NACIONAL') || e.tipos.includes('CLIENTE_EXTRANJERO'),
  )
  const { data: entidadesData } = useQuery({
    queryKey: ['entidades-todas-options'],
    queryFn: () => entidadesService.list({ limit: 500, activo: true }),
    staleTime: 60_000,
  })
  const entidades = entidadesData?.data ?? []

  const { data: tiposEmbarqueData } = useQuery({ queryKey: ['tipos-embarque-options'], queryFn: () => tiposEmbarqueService.list({ limit: 200 }), staleTime: 5 * 60_000 })
  const { data: mercadosData } = useQuery({ queryKey: ['mercados-options'], queryFn: () => mercadosService.list({ limit: 200 }), staleTime: 5 * 60_000 })
  const { data: paisesData } = useQuery({ queryKey: ['paises-options', fields.mercadoId], queryFn: () => paisesService.list({ limit: 200, mercadoId: fields.mercadoId }), staleTime: 60_000, enabled: !!fields.mercadoId })
  const { data: puertosData } = useQuery({ queryKey: ['puertos-options', fields.paisDestinoId], queryFn: () => puertosService.list({ limit: 200, paisId: fields.paisDestinoId }), staleTime: 60_000, enabled: !!fields.paisDestinoId })
  const { data: monedasData } = useQuery({ queryKey: ['monedas-options'], queryFn: () => monedasService.list({ limit: 200 }), staleTime: 5 * 60_000 })
  const { data: especiesData } = useQuery({ queryKey: ['especies-options'], queryFn: () => especiesService.list({ limit: 200 }), staleTime: 5 * 60_000 })
  const { data: variedadesData } = useQuery({ queryKey: ['variedades-options', linea.especieId], queryFn: () => variedadesService.list({ limit: 200, especieId: linea.especieId }), staleTime: 60_000, enabled: !!linea.especieId })
  const { data: categoriasData } = useQuery({ queryKey: ['categorias-options', linea.especieId], queryFn: () => categoriasService.list({ limit: 200, especieId: linea.especieId }), staleTime: 60_000, enabled: !!linea.especieId })
  const { data: calibresData } = useQuery({ queryKey: ['calibres-options', linea.especieId], queryFn: () => calibresService.list({ limit: 200, especieId: linea.especieId }), staleTime: 60_000, enabled: !!linea.especieId })
  const { data: tiposPalletData } = useQuery({ queryKey: ['tipos-pallet-options'], queryFn: () => tiposPalletService.list({ limit: 200 }), staleTime: 5 * 60_000 })
  const { data: articulosData } = useQuery({ queryKey: ['articulos-embalaje-options'], queryFn: () => articulosService.list({ limit: 500, tipo: 'EMBALAJE', activo: true }), staleTime: 60_000 })
  const { data: condicionesPagoData } = useQuery({ queryKey: ['condiciones-pago-options', 'VENTA'], queryFn: () => condicionesPagoService.list({ tipo: 'VENTA' }), staleTime: 60_000 })

  const { data: tiposParametroData } = useQuery({ queryKey: ['tipos-parametro-options'], queryFn: () => tiposParametroService.list({ limit: 200 }), staleTime: 5 * 60_000 })
  const tipoFleteTipoId = tiposParametroData?.data.find((t) => t.codigo === 'TIPO_FLETE')?.id
  const modalidadVentaTipoId = tiposParametroData?.data.find((t) => t.codigo === 'MODALIDAD_VENTA')?.id
  const incotermTipoId = tiposParametroData?.data.find((t) => t.codigo === 'INCOTERM')?.id
  const { data: tiposFleteData } = useQuery({ queryKey: ['parametros-options', tipoFleteTipoId], queryFn: () => parametrosService.list({ limit: 200, tipoParametroId: tipoFleteTipoId }), staleTime: 5 * 60_000, enabled: !!tipoFleteTipoId })
  const { data: modalidadesVentaData } = useQuery({ queryKey: ['parametros-options', modalidadVentaTipoId], queryFn: () => parametrosService.list({ limit: 200, tipoParametroId: modalidadVentaTipoId }), staleTime: 5 * 60_000, enabled: !!modalidadVentaTipoId })
  const { data: incotermsData } = useQuery({ queryKey: ['parametros-options', incotermTipoId], queryFn: () => parametrosService.list({ limit: 200, tipoParametroId: incotermTipoId }), staleTime: 5 * 60_000, enabled: !!incotermTipoId })

  const condicionPagoSeleccionada = (condicionesPagoData?.data ?? []).find((c) => c.id === fields.condicionPagoId)
  // "Sin definir" (condicionPagoId null) oculta el preview. Si la selección
  // no cambió respecto de lo guardado, se muestra el snapshot persistido
  // (NotaVentaCuotaPago — inmutable aunque la CondicionPago se edite después).
  // Si el usuario eligió/cambió la Forma de Pago, se previsualizan las cuotas
  // vigentes del catálogo — son las que se snapshotearán recién al guardar.
  const cuotasPreview = !fields.condicionPagoId
    ? []
    : isEdit && fields.condicionPagoId === notaVenta?.data.condicionPagoId
      ? notaVenta?.data.cuotasPago ?? []
      : condicionPagoSeleccionada?.cuotas ?? []

  const { data: clienteDetalle } = useQuery({
    ...entidadDetailOptions(fields.clienteId || 0),
    enabled: !!fields.clienteId,
  })
  const direccionesCliente = clienteDetalle?.direcciones ?? []

  useEffect(() => {
    if (notaVenta) {
      const d = notaVenta.data
      setFields({
        fecha: d.fecha.slice(0, 10),
        clienteId: d.clienteId,
        compradorId: d.compradorId,
        notifyId: d.notifyId,
        clienteFinalId: d.clienteFinalId,
        tipoEmbarqueId: d.tipoEmbarqueId,
        mercadoId: d.mercadoId,
        paisDestinoId: d.paisDestinoId,
        puertoDestinoId: d.puertoDestinoId,
        direccionId: d.direccionId,
        direccionDetalle: d.direccionDetalle ?? '',
        monedaId: d.monedaId,
        modalidadVentaId: d.modalidadVentaId,
        clausulaVentaId: d.clausulaVentaId,
        tipoFleteId: d.tipoFleteId,
        condicionPagoId: d.condicionPagoId,
        observaciones: d.observaciones ?? '',
      })
    }
  }, [notaVenta])

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!fields.fecha) e.fecha = 'La fecha es requerida'
    if (!fields.clienteId) e.clienteId = 'El cliente es requerido'
    if (!fields.tipoEmbarqueId) e.tipoEmbarqueId = 'El tipo de embarque es requerido'
    if (!fields.mercadoId) e.mercadoId = 'El mercado es requerido'
    if (!fields.paisDestinoId) e.paisDestinoId = 'El país destino es requerido'
    if (!fields.monedaId) e.monedaId = 'La moneda es requerida'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function buildPayload(): NotaVentaCreateInput {
    return {
      fecha: fields.fecha,
      clienteId: fields.clienteId,
      compradorId: fields.compradorId,
      notifyId: fields.notifyId,
      clienteFinalId: fields.clienteFinalId,
      tipoEmbarqueId: fields.tipoEmbarqueId,
      mercadoId: fields.mercadoId,
      paisDestinoId: fields.paisDestinoId,
      puertoDestinoId: fields.puertoDestinoId,
      direccionId: fields.direccionId,
      direccionDetalle: fields.direccionDetalle.trim() || undefined,
      monedaId: fields.monedaId,
      modalidadVentaId: fields.modalidadVentaId,
      clausulaVentaId: fields.clausulaVentaId,
      tipoFleteId: fields.tipoFleteId,
      condicionPagoId: fields.condicionPagoId,
      observaciones: fields.observaciones.trim() || undefined,
    }
  }

  const createMutation = useMutation({
    mutationFn: (data: NotaVentaCreateInput) => notasVentaService.create(data),
    onSuccess: (res) => {
      toast.success(`Cierre Comercial creado — Folio ${res.data.folio}`)
      queryClient.invalidateQueries({ queryKey: notasVentaKeys.all })
      router.push(`/dashboard/ventas/cierre/${res.data.id}`)
    },
    onError: (e: Error) => toast.error(e.message || 'Error al crear el Cierre Comercial'),
  })

  const updateMutation = useMutation({
    mutationFn: (data: NotaVentaCreateInput) => notasVentaService.update(notaVentaId!, data),
    onSuccess: () => {
      toast.success('Cierre Comercial actualizado')
      queryClient.invalidateQueries({ queryKey: notasVentaKeys.all })
      queryClient.invalidateQueries({ queryKey: notasVentaKeys.detail(notaVentaId!) })
    },
    onError: (e: Error) => toast.error(e.message || 'Error al actualizar el Cierre Comercial'),
  })

  const addDetalleMutation = useMutation({
    mutationFn: (data: NotaVentaDetalleCreateInput) => notasVentaService.addDetalle(notaVentaId!, data),
    onSuccess: () => {
      toast.success('Línea agregada')
      setLinea(LINEA_EMPTY)
      setLineaErrors({})
      queryClient.invalidateQueries({ queryKey: notasVentaKeys.detail(notaVentaId!) })
    },
    onError: (e: Error) => toast.error(e.message || 'Error al agregar la línea'),
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
    if (!linea.fechaCompromiso) e.fechaCompromiso = 'Requerida'
    if (!linea.especieId) e.especieId = 'Requerida'
    if (!linea.variedadId) e.variedadId = 'Requerida'
    if (!linea.articuloId) e.articuloId = 'Requerido'
    if (!linea.cantidadPallets || Number(linea.cantidadPallets) <= 0) e.cantidadPallets = 'Debe ser mayor a 0'
    if (!linea.cajasPorPallet || Number(linea.cajasPorPallet) <= 0) e.cajasPorPallet = 'Debe ser mayor a 0'
    if (!linea.cajas || Number(linea.cajas) <= 0) e.cajas = 'Debe ser mayor a 0'
    if (!linea.precio || Number(linea.precio) <= 0) e.precio = 'Debe ser mayor a 0'
    if (!linea.calibreInicioId) e.calibreInicioId = 'Requerido'
    if (!linea.calibreFinId) e.calibreFinId = 'Requerido'
    setLineaErrors(e)
    return Object.keys(e).length === 0
  }

  function handleAgregarLinea() {
    if (!validarLinea()) return
    addDetalleMutation.mutate({
      fechaCompromiso: linea.fechaCompromiso,
      especieId: linea.especieId,
      variedadId: linea.variedadId,
      articuloId: linea.articuloId,
      categoriaId: linea.categoriaId,
      tipoPalletId: linea.tipoPalletId,
      cantidadPallets: Number(linea.cantidadPallets),
      cajasPorPallet: Number(linea.cajasPorPallet),
      cajas: Number(linea.cajas),
      precio: Number(linea.precio),
      calibreInicioId: linea.calibreInicioId,
      calibreFinId: linea.calibreFinId,
    })
  }

  const articuloSeleccionado = (articulosData?.data ?? []).find((a) => a.id === linea.articuloId)

  if (isEdit && isLoading) {
    return <p className='text-sm text-muted-foreground'>Cargando…</p>
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <div className='space-y-6'>
      <Card>
        <CardHeader>
          <CardTitle>{isEdit ? `Cierre Comercial — Folio ${notaVenta?.data.folio}` : 'Nuevo Cierre Comercial'}</CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='grid gap-4 sm:grid-cols-2'>
            <div className='space-y-1.5'>
              <Label>Fecha <span className='text-destructive'>*</span></Label>
              <Input type='date' value={fields.fecha} onChange={(e) => setFields((f) => ({ ...f, fecha: e.target.value }))} />
              {errors.fecha && <p className='text-xs text-destructive'>{errors.fecha}</p>}
            </div>
            <div className='space-y-1.5'>
              <Label>Cliente <span className='text-destructive'>*</span></Label>
              <Combobox
                value={fields.clienteId ? String(fields.clienteId) : ''}
                onChange={(v) => setFields((f) => ({ ...f, clienteId: Number(v), direccionId: null }))}
                placeholder='Seleccionar cliente...'
                searchPlaceholder='Buscar cliente...'
                options={clientes.map((c) => ({ value: String(c.id), label: `${c.descripcion} — ${c.razonSocial}` }))}
              />
              {errors.clienteId && <p className='text-xs text-destructive'>{errors.clienteId}</p>}
            </div>

            <div className='space-y-1.5'>
              <Label>Comprador</Label>
              <Combobox
                value={fields.compradorId ? String(fields.compradorId) : 'none'}
                onChange={(v) => setFields((f) => ({ ...f, compradorId: v === 'none' ? null : Number(v) }))}
                placeholder='Sin comprador'
                searchPlaceholder='Buscar entidad...'
                options={[{ value: 'none', label: 'Sin comprador' }, ...entidades.map((e) => ({ value: String(e.id), label: e.descripcion }))]}
              />
            </div>
            <div className='space-y-1.5'>
              <Label>Notify</Label>
              <Combobox
                value={fields.notifyId ? String(fields.notifyId) : 'none'}
                onChange={(v) => setFields((f) => ({ ...f, notifyId: v === 'none' ? null : Number(v) }))}
                placeholder='Sin notify'
                searchPlaceholder='Buscar entidad...'
                options={[{ value: 'none', label: 'Sin notify' }, ...entidades.map((e) => ({ value: String(e.id), label: e.descripcion }))]}
              />
            </div>
            <div className='space-y-1.5'>
              <Label>Cliente Final</Label>
              <Combobox
                value={fields.clienteFinalId ? String(fields.clienteFinalId) : 'none'}
                onChange={(v) => setFields((f) => ({ ...f, clienteFinalId: v === 'none' ? null : Number(v) }))}
                placeholder='Sin cliente final'
                searchPlaceholder='Buscar entidad...'
                options={[{ value: 'none', label: 'Sin cliente final' }, ...entidades.map((e) => ({ value: String(e.id), label: e.descripcion }))]}
              />
            </div>

            <div className='space-y-1.5'>
              <Label>Tipo de Embarque <span className='text-destructive'>*</span></Label>
              <Select value={fields.tipoEmbarqueId ? String(fields.tipoEmbarqueId) : ''} onValueChange={(v) => setFields((f) => ({ ...f, tipoEmbarqueId: Number(v) }))}>
                <SelectTrigger><SelectValue placeholder='Seleccionar...' /></SelectTrigger>
                <SelectContent>
                  {(tiposEmbarqueData?.data ?? []).map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>{t.descripcion}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.tipoEmbarqueId && <p className='text-xs text-destructive'>{errors.tipoEmbarqueId}</p>}
            </div>
            <div className='space-y-1.5'>
              <Label>Mercado <span className='text-destructive'>*</span></Label>
              <Select value={fields.mercadoId ? String(fields.mercadoId) : ''} onValueChange={(v) => setFields((f) => ({ ...f, mercadoId: Number(v), paisDestinoId: 0, puertoDestinoId: null }))}>
                <SelectTrigger><SelectValue placeholder='Seleccionar...' /></SelectTrigger>
                <SelectContent>
                  {(mercadosData?.data ?? []).map((m) => (
                    <SelectItem key={m.id} value={String(m.id)}>{m.descripcion}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.mercadoId && <p className='text-xs text-destructive'>{errors.mercadoId}</p>}
            </div>

            <div className='space-y-1.5'>
              <Label>País Destino <span className='text-destructive'>*</span></Label>
              <Select value={fields.paisDestinoId ? String(fields.paisDestinoId) : ''} onValueChange={(v) => setFields((f) => ({ ...f, paisDestinoId: Number(v), puertoDestinoId: null }))} disabled={!fields.mercadoId}>
                <SelectTrigger><SelectValue placeholder={fields.mercadoId ? 'Seleccionar...' : 'Elige un mercado primero'} /></SelectTrigger>
                <SelectContent>
                  {(paisesData?.data ?? []).map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.descripcion}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.paisDestinoId && <p className='text-xs text-destructive'>{errors.paisDestinoId}</p>}
            </div>
            <div className='space-y-1.5'>
              <Label>Puerto Destino</Label>
              <Select value={fields.puertoDestinoId ? String(fields.puertoDestinoId) : ''} onValueChange={(v) => setFields((f) => ({ ...f, puertoDestinoId: v ? Number(v) : null }))} disabled={!fields.paisDestinoId}>
                <SelectTrigger><SelectValue placeholder='Sin puerto' /></SelectTrigger>
                <SelectContent>
                  {(puertosData?.data ?? []).map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.descripcion}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className='space-y-1.5'>
              <Label>Dirección</Label>
              <Select value={fields.direccionId ? String(fields.direccionId) : ''} onValueChange={(v) => setFields((f) => ({ ...f, direccionId: v ? Number(v) : null }))} disabled={!fields.clienteId}>
                <SelectTrigger><SelectValue placeholder={fields.clienteId ? 'Sin dirección' : 'Elige un cliente primero'} /></SelectTrigger>
                <SelectContent>
                  {direccionesCliente.map((d) => (
                    <SelectItem key={d.id} value={String(d.id)}>{d.descripcion} — {d.direccion}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className='space-y-1.5'>
              <Label>Detalle de Dirección</Label>
              <Input value={fields.direccionDetalle} onChange={(e) => setFields((f) => ({ ...f, direccionDetalle: e.target.value }))} />
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
              <Label>Tipo de Flete</Label>
              <Select value={fields.tipoFleteId ? String(fields.tipoFleteId) : 'none'} onValueChange={(v) => setFields((f) => ({ ...f, tipoFleteId: v === 'none' ? null : Number(v) }))}>
                <SelectTrigger><SelectValue placeholder='Sin definir' /></SelectTrigger>
                <SelectContent>
                  <SelectItem value='none'>Sin definir</SelectItem>
                  {(tiposFleteData?.data ?? []).map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.descripcion}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className='space-y-1.5'>
              <Label>Modalidad de Venta</Label>
              <Select value={fields.modalidadVentaId ? String(fields.modalidadVentaId) : 'none'} onValueChange={(v) => setFields((f) => ({ ...f, modalidadVentaId: v === 'none' ? null : Number(v) }))}>
                <SelectTrigger><SelectValue placeholder='Sin definir' /></SelectTrigger>
                <SelectContent>
                  <SelectItem value='none'>Sin definir</SelectItem>
                  {(modalidadesVentaData?.data ?? []).map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.descripcion}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className='space-y-1.5'>
              <Label>Incoterm (Cláusula de Venta)</Label>
              <Select value={fields.clausulaVentaId ? String(fields.clausulaVentaId) : 'none'} onValueChange={(v) => setFields((f) => ({ ...f, clausulaVentaId: v === 'none' ? null : Number(v) }))}>
                <SelectTrigger><SelectValue placeholder='Sin definir' /></SelectTrigger>
                <SelectContent>
                  <SelectItem value='none'>Sin definir</SelectItem>
                  {(incotermsData?.data ?? []).map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.descripcion}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className='space-y-1.5'>
              <Label>Forma de Pago</Label>
              <Select value={fields.condicionPagoId ? String(fields.condicionPagoId) : 'none'} onValueChange={(v) => setFields((f) => ({ ...f, condicionPagoId: v === 'none' ? null : Number(v) }))}>
                <SelectTrigger><SelectValue placeholder='Sin definir' /></SelectTrigger>
                <SelectContent>
                  <SelectItem value='none'>Sin definir</SelectItem>
                  {(condicionesPagoData?.data ?? []).map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.descripcion}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {cuotasPreview.length > 0 && (
            <div className='rounded-md border p-3'>
              <p className='mb-2 text-xs font-medium text-muted-foreground'>Plazo de pago (determinado por la Forma de Pago)</p>
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

          <div className='space-y-1.5'>
            <Label>Observaciones</Label>
            <Textarea value={fields.observaciones} onChange={(e) => setFields((f) => ({ ...f, observaciones: e.target.value }))} rows={3} />
          </div>

          <div className='flex justify-end gap-2'>
            <Button variant='outline' onClick={() => router.push('/dashboard/ventas/cierre')} disabled={isPending}>Cancelar</Button>
            <Button onClick={handleSubmit} isLoading={isPending}>
              <Icons.check className='mr-1 h-4 w-4' /> {isEdit ? 'Guardar cambios' : 'Crear Cierre Comercial'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {isEdit && (
        <Card>
          <CardHeader>
            <CardTitle>Detalle de fruta comprometida</CardTitle>
          </CardHeader>
          <CardContent className='space-y-4'>
            {(notaVenta?.data.detalles.length ?? 0) > 0 && (
              <div className='space-y-2 rounded-md border p-2'>
                {notaVenta!.data.detalles.map((d) => (
                  <div key={d.id} className='flex flex-wrap items-center gap-2 border-b pb-2 text-sm last:border-b-0 last:pb-0'>
                    <span className='font-medium'>{d.especie.descripcion} / {d.variedad.descripcion}</span>
                    <span className='text-muted-foreground'>{d.articulo.descripcion}</span>
                    {d.categoria && <span className='text-muted-foreground'>· {d.categoria.descripcion}</span>}
                    <span className='text-muted-foreground'>· Calibre: {d.calibreInicio.codigo}–{d.calibreFin.codigo}</span>
                    <span className='ml-auto text-muted-foreground'>{d.cantidadPallets} pallets × {d.cajasPorPallet} cj · ${d.precio}/cj</span>
                  </div>
                ))}
              </div>
            )}

            <Separator />

            <div className='grid gap-3 sm:grid-cols-2 md:grid-cols-3'>
              <div className='space-y-1.5'>
                <Label>Fecha Compromiso <span className='text-destructive'>*</span></Label>
                <Input type='date' value={linea.fechaCompromiso} onChange={(e) => setLinea((l) => ({ ...l, fechaCompromiso: e.target.value }))} />
                {lineaErrors.fechaCompromiso && <p className='text-xs text-destructive'>{lineaErrors.fechaCompromiso}</p>}
              </div>
              <div className='space-y-1.5'>
                <Label>Especie <span className='text-destructive'>*</span></Label>
                <Select value={linea.especieId ? String(linea.especieId) : ''} onValueChange={(v) => setLinea((l) => ({ ...l, especieId: Number(v), variedadId: 0, categoriaId: null, calibreInicioId: 0, calibreFinId: 0 }))}>
                  <SelectTrigger><SelectValue placeholder='Seleccionar...' /></SelectTrigger>
                  <SelectContent>
                    {(especiesData?.data ?? []).map((e) => (
                      <SelectItem key={e.id} value={String(e.id)}>{e.descripcion}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {lineaErrors.especieId && <p className='text-xs text-destructive'>{lineaErrors.especieId}</p>}
              </div>
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
                <Label>Artículo (Embalaje) <span className='text-destructive'>*</span></Label>
                <Select value={linea.articuloId ? String(linea.articuloId) : ''} onValueChange={(v) => setLinea((l) => ({ ...l, articuloId: Number(v) }))}>
                  <SelectTrigger><SelectValue placeholder='Seleccionar...' /></SelectTrigger>
                  <SelectContent>
                    {(articulosData?.data ?? []).map((a) => (
                      <SelectItem key={a.id} value={String(a.id)}>{a.codigo} — {a.descripcion}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {lineaErrors.articuloId && <p className='text-xs text-destructive'>{lineaErrors.articuloId}</p>}
              </div>
              <div className='space-y-1.5'>
                <Label>Categoría</Label>
                <Select value={linea.categoriaId ? String(linea.categoriaId) : ''} onValueChange={(v) => setLinea((l) => ({ ...l, categoriaId: v ? Number(v) : null }))} disabled={!linea.especieId}>
                  <SelectTrigger><SelectValue placeholder='Sin categoría' /></SelectTrigger>
                  <SelectContent>
                    {(categoriasData?.data ?? []).map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.descripcion}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className='space-y-1.5'>
                <Label>Tipo Pallet</Label>
                <Select value={linea.tipoPalletId ? String(linea.tipoPalletId) : ''} onValueChange={(v) => setLinea((l) => ({ ...l, tipoPalletId: v ? Number(v) : null }))}>
                  <SelectTrigger><SelectValue placeholder='Sin tipo pallet' /></SelectTrigger>
                  <SelectContent>
                    {(tiposPalletData?.data ?? []).map((t) => (
                      <SelectItem key={t.id} value={String(t.id)}>{t.descripcion}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className='space-y-1.5'>
                <Label>Cant. Pallets <span className='text-destructive'>*</span></Label>
                <Input type='number' value={linea.cantidadPallets} onChange={(e) => setLinea((l) => ({ ...l, cantidadPallets: e.target.value }))} />
                {lineaErrors.cantidadPallets && <p className='text-xs text-destructive'>{lineaErrors.cantidadPallets}</p>}
              </div>
              <div className='space-y-1.5'>
                <Label>Cajas x Pallet <span className='text-destructive'>*</span></Label>
                <Input type='number' value={linea.cajasPorPallet} onChange={(e) => setLinea((l) => ({ ...l, cajasPorPallet: e.target.value }))} />
                {lineaErrors.cajasPorPallet && <p className='text-xs text-destructive'>{lineaErrors.cajasPorPallet}</p>}
              </div>
              <div className='space-y-1.5'>
                <Label>Cajas <span className='text-destructive'>*</span></Label>
                <Input type='number' value={linea.cajas} onChange={(e) => setLinea((l) => ({ ...l, cajas: e.target.value }))} />
                {lineaErrors.cajas && <p className='text-xs text-destructive'>{lineaErrors.cajas}</p>}
              </div>
              <div className='space-y-1.5'>
                <Label>Valor por Caja <span className='text-destructive'>*</span></Label>
                <Input type='number' step='0.01' value={linea.precio} onChange={(e) => setLinea((l) => ({ ...l, precio: e.target.value }))} />
                <p className='text-xs text-muted-foreground'>En la moneda del encabezado ({(monedasData?.data ?? []).find((m) => m.id === fields.monedaId)?.codigo ?? '—'})</p>
                {lineaErrors.precio && <p className='text-xs text-destructive'>{lineaErrors.precio}</p>}
              </div>
            </div>

            <div className='grid gap-3 sm:grid-cols-2'>
              <div className='space-y-1.5'>
                <Label>Calibre Inicio <span className='text-destructive'>*</span></Label>
                <Select value={linea.calibreInicioId ? String(linea.calibreInicioId) : ''} onValueChange={(v) => setLinea((l) => ({ ...l, calibreInicioId: Number(v) }))} disabled={!linea.especieId}>
                  <SelectTrigger><SelectValue placeholder={linea.especieId ? 'Seleccionar...' : 'Elige una especie primero'} /></SelectTrigger>
                  <SelectContent>
                    {(calibresData?.data ?? []).map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.descripcion}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {lineaErrors.calibreInicioId && <p className='text-xs text-destructive'>{lineaErrors.calibreInicioId}</p>}
              </div>
              <div className='space-y-1.5'>
                <Label>Calibre Fin <span className='text-destructive'>*</span></Label>
                <Select value={linea.calibreFinId ? String(linea.calibreFinId) : ''} onValueChange={(v) => setLinea((l) => ({ ...l, calibreFinId: Number(v) }))} disabled={!linea.especieId}>
                  <SelectTrigger><SelectValue placeholder={linea.especieId ? 'Seleccionar...' : 'Elige una especie primero'} /></SelectTrigger>
                  <SelectContent>
                    {(calibresData?.data ?? []).map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.descripcion}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {lineaErrors.calibreFinId && <p className='text-xs text-destructive'>{lineaErrors.calibreFinId}</p>}
              </div>
            </div>

            {articuloSeleccionado && (articuloSeleccionado.etiqueta || articuloSeleccionado.kgNetoEnvase) && (
              <p className='text-xs text-muted-foreground'>
                Etiqueta: {articuloSeleccionado.etiqueta ?? '—'} · Kg Neto: {articuloSeleccionado.kgNetoEnvase ?? '—'} · Kg Bruto: {articuloSeleccionado.kgBrutoEnvase ?? '—'}
              </p>
            )}

            <div className='flex justify-end'>
              <Button variant='secondary' onClick={handleAgregarLinea} isLoading={addDetalleMutation.isPending}>
                <Icons.add className='mr-1 h-4 w-4' /> Agregar línea
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
