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
import { Combobox } from '@/components/ui/combobox'
import { createMantenedorService } from '@/features/mantenedor-simple/service'
import { entidadesService } from '@/features/entidades/service'
import { entidadDetailOptions } from '@/features/entidades/queries'
import { articulosService } from '@/features/materiales/articulos/service'
import { condicionesPagoService } from '@/features/condiciones-pago/service'
import { FECHA_REFERENCIA_LABELS } from '@/features/condiciones-pago/types'
import { notaVentaDetailOptions, notasVentaKeys } from '../queries'
import { notasVentaService } from '../service'
import { CLIENTE_SIN_DEFINIR_CODIGO } from '../constants'
import type { NotaVentaCreateInput, NotaVentaDetalleCreateInput, NotaVentaDetalleItem } from '../types'

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
  compradorContactoId: number | null
  notifyId: number | null
  consignatarioId: number | null
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
  compradorContactoId: null,
  notifyId: null,
  consignatarioId: null,
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

// Cajas por pallet aún no tiene mantenedor propio (pendiente de desarrollar).
// Mientras tanto se asume un valor fijo, usado para precalcular "Cajas" y
// que el usuario puede sobrescribir manualmente en el campo.
const CAJAS_POR_PALLET_DEFAULT = 108

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
  calibreIds: number[]
}

const LINEA_EMPTY: NuevaLinea = {
  fechaCompromiso: '',
  especieId: 0,
  variedadId: 0,
  articuloId: 0,
  categoriaId: null,
  tipoPalletId: null,
  cantidadPallets: '',
  cajasPorPallet: String(CAJAS_POR_PALLET_DEFAULT),
  cajas: '',
  precio: '',
  calibreIds: [],
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
  const [editingDetalleId, setEditingDetalleId] = useState<number | null>(null)
  const [deleteDetalleId, setDeleteDetalleId] = useState<number | null>(null)
  const [calibreDesdeId, setCalibreDesdeId] = useState<number | null>(null)
  const [calibreHastaId, setCalibreHastaId] = useState<number | null>(null)

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
  const clientePlaceholder = (clientesData?.data ?? []).find((e) => e.codigo === CLIENTE_SIN_DEFINIR_CODIGO)
  const { data: entidadesData } = useQuery({
    queryKey: ['entidades-todas-options'],
    queryFn: () => entidadesService.list({ limit: 500, activo: true }),
    staleTime: 60_000,
  })
  const entidades = entidadesData?.data ?? []
  // El backend exige tipo CONSIGNATARIO al guardar (notas-venta.service.ts)
  // — filtrar acá evita elegir una entidad que después falla al guardar
  // (IMP-QA-R1-005).
  const consignatarios = entidades.filter((e) => e.tipos.includes('CONSIGNATARIO'))

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
  const contactosCliente = clienteDetalle?.contactos ?? []

  useEffect(() => {
    if (notaVenta) {
      const d = notaVenta.data
      setFields({
        fecha: d.fecha.slice(0, 10),
        clienteId: d.clienteId,
        compradorContactoId: d.compradorContactoId,
        notifyId: d.notifyId,
        consignatarioId: d.consignatarioId,
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

  // Al crear un Cierre Comercial nuevo, si aún no se eligió cliente, se
  // preselecciona la Entidad placeholder "Cliente Sin Definir" — editable
  // en cualquier momento, incluso después de guardado (ver badge más abajo).
  useEffect(() => {
    if (!isEdit && !fields.clienteId && clientePlaceholder) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFields((f) => ({ ...f, clienteId: clientePlaceholder.id }))
    }
  }, [isEdit, fields.clienteId, clientePlaceholder])

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
      compradorContactoId: fields.compradorContactoId,
      notifyId: fields.notifyId,
      consignatarioId: fields.consignatarioId,
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
      resetCalibreRango()
      queryClient.invalidateQueries({ queryKey: notasVentaKeys.detail(notaVentaId!) })
    },
    onError: (e: Error) => toast.error(e.message || 'Error al agregar la línea'),
  })

  const updateDetalleMutation = useMutation({
    mutationFn: (data: NotaVentaDetalleCreateInput) => notasVentaService.updateDetalle(notaVentaId!, editingDetalleId!, data),
    onSuccess: () => {
      toast.success('Línea actualizada')
      setLinea(LINEA_EMPTY)
      setLineaErrors({})
      setEditingDetalleId(null)
      resetCalibreRango()
      queryClient.invalidateQueries({ queryKey: notasVentaKeys.detail(notaVentaId!) })
    },
    onError: (e: Error) => toast.error(e.message || 'Error al actualizar la línea'),
  })

  const removeDetalleMutation = useMutation({
    mutationFn: (detalleId: number) => notasVentaService.removeDetalle(notaVentaId!, detalleId),
    onSuccess: () => {
      toast.success('Línea eliminada')
      setDeleteDetalleId(null)
      queryClient.invalidateQueries({ queryKey: notasVentaKeys.detail(notaVentaId!) })
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
    if (!linea.fechaCompromiso) e.fechaCompromiso = 'Requerida'
    if (!linea.especieId) e.especieId = 'Requerida'
    if (!linea.variedadId) e.variedadId = 'Requerida'
    if (!linea.articuloId) e.articuloId = 'Requerido'
    if (!linea.cantidadPallets || Number(linea.cantidadPallets) <= 0) e.cantidadPallets = 'Debe ser mayor a 0'
    if (!linea.cajasPorPallet || Number(linea.cajasPorPallet) <= 0) e.cajasPorPallet = 'Debe ser mayor a 0'
    if (!linea.cajas || Number(linea.cajas) <= 0) e.cajas = 'Debe ser mayor a 0'
    if (!linea.precio || Number(linea.precio) <= 0) e.precio = 'Debe ser mayor a 0'
    if (linea.calibreIds.length === 0) e.calibreIds = 'Selecciona al menos un calibre'
    setLineaErrors(e)
    return Object.keys(e).length === 0
  }

  function handleGuardarLinea() {
    if (!validarLinea()) return
    const payload: NotaVentaDetalleCreateInput = {
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
      calibreIds: linea.calibreIds,
    }
    if (editingDetalleId) updateDetalleMutation.mutate(payload)
    else addDetalleMutation.mutate(payload)
  }

  function handleEditarLinea(d: NotaVentaDetalleItem) {
    setEditingDetalleId(d.id)
    setLinea({
      fechaCompromiso: d.fechaCompromiso.slice(0, 10),
      especieId: d.especieId,
      variedadId: d.variedadId,
      articuloId: d.articuloId,
      categoriaId: d.categoriaId,
      tipoPalletId: d.tipoPalletId,
      cantidadPallets: String(d.cantidadPallets),
      cajasPorPallet: String(d.cajasPorPallet),
      cajas: String(d.cajas),
      precio: d.precio,
      calibreIds: d.calibres.map((c) => c.calibre.id),
    })
    setLineaErrors({})
    resetCalibreRango()
  }

  function handleCancelarEdicionLinea() {
    setEditingDetalleId(null)
    setLinea(LINEA_EMPTY)
    setLineaErrors({})
    resetCalibreRango()
  }

  function resetCalibreRango() {
    setCalibreDesdeId(null)
    setCalibreHastaId(null)
  }

  function agregarRangoCalibres() {
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

  const articuloSeleccionado = (articulosData?.data ?? []).find((a) => a.id === linea.articuloId)
  const cajasPorPalletValor = Number(linea.cajasPorPallet) || CAJAS_POR_PALLET_DEFAULT
  const lineaMutationPending = addDetalleMutation.isPending || updateDetalleMutation.isPending

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
              <Label className='flex items-center gap-2'>
                Cliente <span className='text-destructive'>*</span>
                {clientePlaceholder && fields.clienteId === clientePlaceholder.id && (
                  <Badge variant='secondary'>Cliente sin definir</Badge>
                )}
              </Label>
              <Combobox
                value={fields.clienteId ? String(fields.clienteId) : ''}
                onChange={(v) => setFields((f) => ({ ...f, clienteId: Number(v), direccionId: null, compradorContactoId: null }))}
                placeholder='Seleccionar cliente...'
                searchPlaceholder='Buscar cliente...'
                options={clientes.map((c) => ({ value: String(c.id), label: `${c.descripcion} — ${c.razonSocial}` }))}
              />
              {errors.clienteId && <p className='text-xs text-destructive'>{errors.clienteId}</p>}
            </div>

            <div className='space-y-1.5'>
              <Label>Comprador (Contacto del Cliente)</Label>
              <Select
                value={fields.compradorContactoId ? String(fields.compradorContactoId) : 'none'}
                onValueChange={(v) => setFields((f) => ({ ...f, compradorContactoId: v === 'none' ? null : Number(v) }))}
                disabled={!fields.clienteId}
              >
                <SelectTrigger><SelectValue placeholder={fields.clienteId ? 'Sin comprador' : 'Selecciona un cliente primero'} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value='none'>Sin comprador</SelectItem>
                  {contactosCliente.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              <Label>Consignatario</Label>
              <Combobox
                value={fields.consignatarioId ? String(fields.consignatarioId) : 'none'}
                onChange={(v) => setFields((f) => ({ ...f, consignatarioId: v === 'none' ? null : Number(v) }))}
                placeholder='Sin consignatario'
                searchPlaceholder='Buscar entidad...'
                options={[{ value: 'none', label: 'Sin consignatario' }, ...consignatarios.map((e) => ({ value: String(e.id), label: e.descripcion }))]}
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
              <Label>Condición de Pago</Label>
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
              <p className='mb-2 text-xs font-medium text-muted-foreground'>Plazo de pago (determinado por la Condición de Pago)</p>
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
            <div className='space-y-3'>
              {/* Fila 1: Especie, Variedad, Categoría */}
              <div className='grid gap-3 sm:grid-cols-2 md:grid-cols-4'>
                <div className='space-y-1.5'>
                  <Label>Especie <span className='text-destructive'>*</span></Label>
                  <Select value={linea.especieId ? String(linea.especieId) : ''} onValueChange={(v) => { setLinea((l) => ({ ...l, especieId: Number(v), variedadId: 0, categoriaId: null, calibreIds: [] })); resetCalibreRango() }}>
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
              </div>

              {/* Fila 2: Artículo (2 columnas), Tipo Pallet */}
              <div className='grid gap-3 sm:grid-cols-2 md:grid-cols-4'>
                <div className='space-y-1.5 sm:col-span-2'>
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
              </div>

              {/* Fila 3: Cant. Pallets, Cajas (auto = pallets × cajas/pallet, editable), Valor por Caja */}
              <div className='grid gap-3 sm:grid-cols-2 md:grid-cols-4'>
                <div className='space-y-1.5'>
                  <Label>Cant. Pallets <span className='text-destructive'>*</span></Label>
                  <Input
                    type='number'
                    value={linea.cantidadPallets}
                    onChange={(e) => {
                      const v = e.target.value
                      setLinea((l) => ({ ...l, cantidadPallets: v, cajas: v ? String(Number(v) * cajasPorPalletValor) : l.cajas }))
                    }}
                  />
                  {lineaErrors.cantidadPallets && <p className='text-xs text-destructive'>{lineaErrors.cantidadPallets}</p>}
                </div>
                <div className='space-y-1.5'>
                  <Label>Cajas ({cajasPorPalletValor} por pallet) <span className='text-destructive'>*</span></Label>
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

              {/* Fila 4: Calibre Inicio, Calibre Fin, Agregar */}
              <div className='grid gap-3 sm:grid-cols-2 md:grid-cols-4'>
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
                  <Button type='button' variant='secondary' className='w-full' onClick={agregarRangoCalibres} disabled={!linea.especieId || !calibreDesdeId}>
                    <Icons.add className='mr-1 h-4 w-4' /> Agregar
                  </Button>
                </div>
              </div>

              <div className='space-y-1.5'>
                <Label>Calibres aceptados <span className='text-destructive'>*</span></Label>
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

              {/* Fila 5: Fecha Compromiso */}
              <div className='grid gap-3 sm:grid-cols-2 md:grid-cols-4'>
                <div className='space-y-1.5'>
                  <Label>Fecha Compromiso <span className='text-destructive'>*</span></Label>
                  <Input type='date' value={linea.fechaCompromiso} onChange={(e) => setLinea((l) => ({ ...l, fechaCompromiso: e.target.value }))} />
                  {lineaErrors.fechaCompromiso && <p className='text-xs text-destructive'>{lineaErrors.fechaCompromiso}</p>}
                </div>
              </div>
            </div>

            {articuloSeleccionado && (articuloSeleccionado.etiqueta || articuloSeleccionado.kgNetoEnvase) && (
              <p className='text-xs text-muted-foreground'>
                Etiqueta: {articuloSeleccionado.etiqueta?.descripcion ?? '—'} · Kg Neto: {articuloSeleccionado.kgNetoEnvase ?? '—'} · Kg Bruto: {articuloSeleccionado.kgBrutoEnvase ?? '—'}
              </p>
            )}

            <div className='flex justify-end gap-2'>
              {editingDetalleId && (
                <Button variant='outline' onClick={handleCancelarEdicionLinea} disabled={lineaMutationPending}>
                  Cancelar edición
                </Button>
              )}
              <Button onClick={handleGuardarLinea} isLoading={lineaMutationPending}>
                {editingDetalleId ? <><Icons.check className='mr-1 h-4 w-4' /> Guardar cambios de línea</> : <><Icons.add className='mr-1 h-4 w-4' /> Agregar línea</>}
              </Button>
            </div>

            {(notaVenta?.data.detalles.length ?? 0) > 0 && (
              <>
                <Separator />
                <div className='overflow-x-auto rounded-md border'>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Especie / Variedad</TableHead>
                        <TableHead>Artículo</TableHead>
                        <TableHead>Categoría</TableHead>
                        <TableHead className='max-w-[180px]'>Calibre</TableHead>
                        <TableHead>Cantidad</TableHead>
                        <TableHead>Precio</TableHead>
                        <TableHead className='w-20 text-right'>Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {notaVenta!.data.detalles.map((d) => (
                        <TableRow key={d.id}>
                          <TableCell className='font-medium whitespace-nowrap'>{d.especie.descripcion} / {d.variedad.descripcion}</TableCell>
                          <TableCell className='whitespace-nowrap text-muted-foreground'>{d.articulo.descripcion}</TableCell>
                          <TableCell className='whitespace-nowrap text-muted-foreground'>{d.categoria?.descripcion ?? '—'}</TableCell>
                          <TableCell className='max-w-[180px] text-muted-foreground'>
                            <div className='flex flex-wrap gap-1'>
                              {d.calibres.map((c) => (
                                <Badge key={c.calibre.id} variant='outline' className='text-xs'>{c.calibre.descripcion}</Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className='whitespace-nowrap text-muted-foreground'>{d.cantidadPallets} pallets × {d.cajasPorPallet} cj</TableCell>
                          <TableCell className='whitespace-nowrap text-muted-foreground'>${d.precio}/cj</TableCell>
                          <TableCell className='text-right'>
                            <div className='flex justify-end gap-1'>
                              <Button variant='ghost' size='icon' className='h-8 w-8' onClick={() => handleEditarLinea(d)}>
                                <Icons.edit className='h-4 w-4' />
                              </Button>
                              <Button variant='ghost' size='icon' className='h-8 w-8' onClick={() => setDeleteDetalleId(d.id)}>
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
              isOpen={deleteDetalleId != null}
              onClose={() => setDeleteDetalleId(null)}
              onConfirm={() => deleteDetalleId && removeDetalleMutation.mutate(deleteDetalleId)}
              loading={removeDetalleMutation.isPending}
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
