'use client'

import { useState, useEffect, useRef } from 'react'
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
import { cajasPorPalletService } from '@/features/cajas-por-pallet/service'
import { CajasPorPalletQuickCreate } from '@/features/cajas-por-pallet/components/cajas-por-pallet-quick-create'
import { condicionesPagoService } from '@/features/condiciones-pago/service'
import { FECHA_REFERENCIA_LABELS } from '@/features/condiciones-pago/types'
import { notasCalidadService } from '@/features/notas-calidad/service'
import { notasCondicionService } from '@/features/notas-condicion/service'
import { CalidadesPermitidasInput, type CalidadPermitidaPar } from '@/components/shared/calidades-permitidas-input'
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
// Cláusula de Venta (Incoterm) — mantenedor propio (2026-09-30, extraído de
// Parametro): no lleva tipoParametroId, se lista directo.
const clausulasVentaService = createMantenedorService('clausulas-venta')

interface HeaderFields {
  fecha: string
  tipoVenta: 'EXPORTACION' | 'NACIONAL'
  clienteId: number
  exportadorId: number | null
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
  tipoBlId: number | null
  condicionPagoId: number | null
  observaciones: string
  contratoNaviero: 'AGROSAN_AGL' | 'CLIENTE'
}

const HEADER_EMPTY: HeaderFields = {
  fecha: new Date().toISOString().slice(0, 10),
  tipoVenta: 'EXPORTACION',
  clienteId: 0,
  exportadorId: null,
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
  tipoBlId: null,
  condicionPagoId: null,
  observaciones: '',
  contratoNaviero: 'AGROSAN_AGL',
}

// Cajas por pallet: cifra teórica del mantenedor CajasPorPallet (embalaje +
// tipo de pallet). Sin default 108 (2026-10-13): si la combinación no tiene
// cantidad configurada se marca error y se ofrece el alta inline.
interface NuevaLinea {
  fechaCompromiso: string
  especieId: number
  variedadId: number
  articuloId: number
  // Etiqueta (Marca): FIJA se autocompleta, DINÁMICA se elige. null = sin resolver.
  etiquetaId: number | null
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
  etiquetaId: null,
  categoriaId: null,
  tipoPalletId: null,
  cantidadPallets: '',
  cajasPorPallet: '',
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
  const [calidadesPermitidas, setCalidadesPermitidas] = useState<CalidadPermitidaPar[]>([])
  const [linea, setLinea] = useState<NuevaLinea>(LINEA_EMPTY)
  const [lineaErrors, setLineaErrors] = useState<Record<string, string>>({})
  // Estado del lookup de cajas por pallet (2026-10-13, CPP-QA-003): distingue
  // "no configurada" (alta inline) de un error técnico (reintentar). Sin default 108.
  const [cajasLookup, setCajasLookup] = useState<'idle' | 'loading' | 'notFound' | 'error'>('idle')
  // Token para descartar respuestas obsoletas del lookup de cajas por pallet.
  const cajasReqRef = useRef(0)
  // Combinación visible actual (CPP-QA ronda 4): una respuesta del lookup solo se
  // aplica si embalaje + tipo de pallet siguen siendo los consultados.
  const lineaRef = useRef(linea)
  useEffect(() => { lineaRef.current = linea }, [linea])
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
  const exportadores = entidades.filter((e) => e.tipos.includes('EXPORTADORA'))
  const { data: notasCalidadData } = useQuery({ queryKey: ['notas-calidad-options'], queryFn: () => notasCalidadService.list(), staleTime: 5 * 60_000 })
  const { data: notasCondicionData } = useQuery({ queryKey: ['notas-condicion-options'], queryFn: () => notasCondicionService.list(), staleTime: 5 * 60_000 })
  const notasCalidad = (notasCalidadData?.data ?? []).filter((n) => !n.bloqueado)
  const notasCondicion = (notasCondicionData?.data ?? []).filter((n) => !n.bloqueado)

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
  const tipoBlTipoId = tiposParametroData?.data.find((t) => t.codigo === 'TIPO_BL')?.id
  const { data: tiposFleteData } = useQuery({ queryKey: ['parametros-options', tipoFleteTipoId], queryFn: () => parametrosService.list({ limit: 200, tipoParametroId: tipoFleteTipoId }), staleTime: 5 * 60_000, enabled: !!tipoFleteTipoId })
  const { data: modalidadesVentaData } = useQuery({ queryKey: ['parametros-options', modalidadVentaTipoId], queryFn: () => parametrosService.list({ limit: 200, tipoParametroId: modalidadVentaTipoId }), staleTime: 5 * 60_000, enabled: !!modalidadVentaTipoId })
  const { data: incotermsData } = useQuery({ queryKey: ['clausulas-venta-options'], queryFn: () => clausulasVentaService.list({ limit: 200, soloActivos: true }), staleTime: 5 * 60_000 })
  const { data: tiposBlData } = useQuery({ queryKey: ['parametros-options', tipoBlTipoId], queryFn: () => parametrosService.list({ limit: 200, tipoParametroId: tipoBlTipoId }), staleTime: 5 * 60_000, enabled: !!tipoBlTipoId })

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
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hidratación del form al cargar la NV a editar
      setFields({
        fecha: d.fecha.slice(0, 10),
        tipoVenta: d.tipoVenta ?? 'EXPORTACION',
        clienteId: d.clienteId,
        exportadorId: d.exportadorId ?? null,
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
        tipoBlId: d.tipoBlId,
        condicionPagoId: d.condicionPagoId,
        observaciones: d.observaciones ?? '',
        contratoNaviero: d.contratoNaviero ?? 'AGROSAN_AGL',
      })
      setCalidadesPermitidas(d.calidadesPermitidas.map((c) => ({ notaCalidadId: c.notaCalidad.id, notaCondicionId: c.notaCondicion.id })))
    }
  }, [notaVenta])

  // Dirección por defecto (2026-09-30): al cargar las direcciones del Cliente
  // elegido, si aún no hay una Dirección seleccionada, se propone la marcada
  // `esPorDefecto` (el form de Entidades exige que exista exactamente una).
  useEffect(() => {
    if (fields.direccionId != null) return
    const porDefecto = clienteDetalle?.direcciones.find((d) => d.esPorDefecto)
    if (porDefecto) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFields((f) => (f.direccionId != null ? f : { ...f, direccionId: porDefecto.id }))
    }
  }, [clienteDetalle, fields.direccionId])

  // Al crear un Cierre Comercial nuevo, si aún no se eligió cliente, se
  // preselecciona la Entidad placeholder "Cliente Sin Definir" — editable
  // en cualquier momento, incluso después de guardado (ver badge más abajo).
  useEffect(() => {
    if (!isEdit && !fields.clienteId && clientePlaceholder) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFields((f) => ({ ...f, clienteId: clientePlaceholder.id }))
    }
  }, [isEdit, fields.clienteId, clientePlaceholder])

  // Exportador por defecto (2026-10-21): al crear, se precarga la EXPORTADORA de
  // la empresa activa (Agrosan). Editable. No aplica al editar.
  const { data: exportadorDefaultData } = useQuery({
    queryKey: ['exportador-predeterminado'],
    queryFn: () => notasVentaService.exportadorPredeterminado(),
    enabled: !isEdit,
    staleTime: 5 * 60_000,
  })
  // Precarga el default UNA sola vez (al llegar el dato), no cada vez que el
  // campo queda en null — si no, elegir "Sin exportador" (null) se re-pisaría
  // con el default (AVR-QA-R1-001).
  const exportadorInitRef = useRef(false)
  useEffect(() => {
    if (isEdit || exportadorInitRef.current) return
    const def = exportadorDefaultData?.data
    if (def) {
      exportadorInitRef.current = true
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFields((f) => ({ ...f, exportadorId: def.id }))
    }
  }, [isEdit, exportadorDefaultData])

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
      tipoVenta: fields.tipoVenta,
      clienteId: fields.clienteId,
      exportadorId: fields.exportadorId,
      calidadesPermitidas,
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
      tipoBlId: fields.tipoBlId,
      condicionPagoId: fields.condicionPagoId,
      observaciones: fields.observaciones.trim() || undefined,
      contratoNaviero: fields.contratoNaviero,
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
      invalidarLookupCajas()
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
      invalidarLookupCajas()
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

  // Auto-fill: al elegir embalaje + tipo de pallet, precarga la cifra teórica
  // (editable). Solo por acción del usuario.
  async function aplicarTeoricaCajas(artId: number, tpId: number | null) {
    // Token de petición (CPP-QA-002) + limpieza siempre al iniciar (CPP-QA-003):
    // nunca se arrastra la cifra anterior (ni en carga ni en error); solo una
    // respuesta exitosa con cantidad la vuelve a setear. Sin default 108.
    const token = ++cajasReqRef.current
    setLinea((l) => ({ ...l, cajasPorPallet: '', cajas: '' }))
    if (!artId || !tpId) {
      setCajasLookup('idle')
      return
    }
    setCajasLookup('loading')
    let teorica: number | null = null
    let huboError = false
    try {
      const r = await cajasPorPalletService.buscar(artId, tpId)
      if (r) teorica = r.cajasPorPallet
    } catch {
      huboError = true
    }
    if (token !== cajasReqRef.current) return
    // La línea pudo cambiarse/reemplazarse mientras el lookup estaba en vuelo.
    if (lineaRef.current.articuloId !== artId || lineaRef.current.tipoPalletId !== tpId) return
    if (huboError) {
      setCajasLookup('error')
      return
    }
    if (teorica == null) {
      setCajasLookup('notFound')
      return
    }
    setCajasLookup('idle')
    setLinea((l) => {
      const pallets = Number(l.cantidadPallets)
      return { ...l, cajasPorPallet: String(teorica), cajas: pallets > 0 ? String(pallets * teorica) : l.cajas }
    })
  }

  function aplicarCajasCreadas(valor: number) {
    cajasReqRef.current++
    setCajasLookup('idle')
    setLinea((l) => {
      const pallets = Number(l.cantidadPallets)
      return { ...l, cajasPorPallet: String(valor), cajas: pallets > 0 ? String(pallets * valor) : l.cajas }
    })
  }

  // Descarta cualquier lookup de cajas en vuelo de forma SÍNCRONA (CPP-QA ronda
  // 5): al reemplazar/descartar la línea, una respuesta atrasada no se aplica.
  function invalidarLookupCajas() {
    cajasReqRef.current++
    setCajasLookup('idle')
  }

  function validarLinea(): boolean {
    const e: Record<string, string> = {}
    if (!linea.fechaCompromiso) e.fechaCompromiso = 'Requerida'
    if (!linea.especieId) e.especieId = 'Requerida'
    if (!linea.variedadId) e.variedadId = 'Requerida'
    if (!linea.articuloId) e.articuloId = 'Requerido'
    // Etiqueta DINÁMICA (el artículo tiene >1 permitida): debe elegirse.
    if (etiquetasPermitidas.length > 1 && !linea.etiquetaId) e.etiquetaId = 'Selecciona la etiqueta'
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
      etiquetaId: linea.etiquetaId,
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
      etiquetaId: d.etiquetaId,
      categoriaId: d.categoriaId,
      tipoPalletId: d.tipoPalletId,
      cantidadPallets: String(d.cantidadPallets),
      cajasPorPallet: String(d.cajasPorPallet),
      cajas: String(d.cajas),
      precio: d.precio,
      calibreIds: d.calibres.map((c) => c.calibre.id),
    })
    invalidarLookupCajas()
    setLineaErrors({})
    resetCalibreRango()
  }

  // Duplicar (2026-10-14): precarga el form con los datos de la línea SIN marcar
  // edición → al "Agregar" se crea una nueva. El usuario ajusta lo que necesite.
  function handleDuplicarLinea(d: NotaVentaDetalleItem) {
    setEditingDetalleId(null)
    setLinea({
      fechaCompromiso: d.fechaCompromiso.slice(0, 10),
      especieId: d.especieId,
      variedadId: d.variedadId,
      articuloId: d.articuloId,
      etiquetaId: d.etiquetaId,
      categoriaId: d.categoriaId,
      tipoPalletId: d.tipoPalletId,
      cantidadPallets: String(d.cantidadPallets),
      cajasPorPallet: String(d.cajasPorPallet),
      cajas: String(d.cajas),
      precio: d.precio,
      calibreIds: d.calibres.map((c) => c.calibre.id),
    })
    invalidarLookupCajas()
    setLineaErrors({})
    resetCalibreRango()
  }

  function handleCancelarEdicionLinea() {
    setEditingDetalleId(null)
    setLinea(LINEA_EMPTY)
    invalidarLookupCajas()
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
  // Embalajes filtrados ESTRICTAMENTE por la especie de la línea (2026-10-14):
  // solo los de esa especie; los sin especie asignada no aparecen nunca; sin
  // especie elegida, lista vacía. La lista completa se conserva para resolver el
  // artículo seleccionado (autofill de kg/etiqueta).
  const articulosLinea = linea.especieId
    ? (articulosData?.data ?? []).filter((a) => a.especieId === linea.especieId)
    : []
  // Set de etiquetas permitido del artículo = principal ∪ adicionales. FIJA (1)
  // → se autocompleta y queda de solo lectura; DINÁMICA (>1) → se elige.
  const etiquetasPermitidas = articuloSeleccionado
    ? [
        ...(articuloSeleccionado.etiqueta ? [articuloSeleccionado.etiqueta] : []),
        ...(articuloSeleccionado.etiquetasAdicionales ?? []).map((a) => a.etiqueta),
      ]
    : []
  const etiquetaFija = etiquetasPermitidas.length === 1
  // Cifra teórica cargada en la línea (0 si aún no se resolvió; sin default 108).
  const cajasPorPalletValor = Number(linea.cajasPorPallet) || 0
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
          {/* Línea 1: Fecha + Tipo de Venta (Exportación/Nacional, 2026-10-06)
              + Contrato naviero Agrosan (Sí/No). */}
          <div className='grid gap-4 sm:grid-cols-3'>
            <div className='space-y-1.5'>
              <Label>Fecha <span className='text-destructive'>*</span></Label>
              <Input type='date' value={fields.fecha} onChange={(e) => setFields((f) => ({ ...f, fecha: e.target.value }))} />
              {errors.fecha && <p className='text-xs text-destructive'>{errors.fecha}</p>}
            </div>
            <div className='space-y-1.5'>
              <Label>Tipo de Venta <span className='text-destructive'>*</span></Label>
              <Select value={fields.tipoVenta} onValueChange={(v) => setFields((f) => ({ ...f, tipoVenta: v as 'EXPORTACION' | 'NACIONAL' }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value='EXPORTACION'>Exportación</SelectItem>
                  <SelectItem value='NACIONAL'>Nacional</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className='space-y-1.5'>
              <Label>Contrato naviero</Label>
              <Select value={fields.contratoNaviero} onValueChange={(v) => setFields((f) => ({ ...f, contratoNaviero: v as 'AGROSAN_AGL' | 'CLIENTE' }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value='AGROSAN_AGL'>Agrosan-AGL</SelectItem>
                  <SelectItem value='CLIENTE'>Cliente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Línea 2: Cliente + Dirección + Detalle de Dirección. */}
          <div className='grid gap-4 sm:grid-cols-3'>
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
              <Label>Dirección</Label>
              <Select value={fields.direccionId ? String(fields.direccionId) : ''} onValueChange={(v) => setFields((f) => ({ ...f, direccionId: v ? Number(v) : null }))} disabled={!fields.clienteId}>
                <SelectTrigger className='w-full'><SelectValue placeholder={fields.clienteId ? 'Sin dirección' : 'Elige un cliente primero'} /></SelectTrigger>
                <SelectContent>
                  {direccionesCliente.map((d) => (
                    <SelectItem key={d.id} value={String(d.id)}>{d.descripcion} — {d.direccion}{d.esPorDefecto ? ' (por defecto)' : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className='space-y-1.5'>
              <Label>Detalle de Dirección</Label>
              <Input value={fields.direccionDetalle} onChange={(e) => setFields((f) => ({ ...f, direccionDetalle: e.target.value }))} />
            </div>
          </div>

          <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
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
              <Label>Exportador</Label>
              <Combobox
                value={fields.exportadorId ? String(fields.exportadorId) : 'none'}
                onChange={(v) => setFields((f) => ({ ...f, exportadorId: v === 'none' ? null : Number(v) }))}
                placeholder='Sin exportador'
                searchPlaceholder='Buscar exportador...'
                options={[{ value: 'none', label: 'Sin exportador' }, ...exportadores.map((e) => ({ value: String(e.id), label: e.descripcion }))]}
              />
              <p className='text-muted-foreground text-xs'>Por defecto, la exportadora de la empresa (Agrosan). Editable.</p>
            </div>
            <div className='sm:col-span-2 lg:col-span-3'>
              <CalidadesPermitidasInput
                value={calidadesPermitidas}
                onChange={setCalidadesPermitidas}
                calidades={notasCalidad.map((n) => ({ id: n.id, descripcion: n.descripcion }))}
                condiciones={notasCondicion.map((n) => ({ id: n.id, descripcion: n.descripcion }))}
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
            <div className='space-y-1.5'>
              <Label>Tipo de BL</Label>
              <Select value={fields.tipoBlId ? String(fields.tipoBlId) : 'none'} onValueChange={(v) => setFields((f) => ({ ...f, tipoBlId: v === 'none' ? null : Number(v) }))}>
                <SelectTrigger><SelectValue placeholder='Sin definir' /></SelectTrigger>
                <SelectContent>
                  <SelectItem value='none'>Sin definir</SelectItem>
                  {(tiposBlData?.data ?? []).map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.descripcion}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className='text-muted-foreground text-xs'>Se propone como valor por defecto al generar cada Embarque.</p>
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
                  <Select value={linea.especieId ? String(linea.especieId) : ''} onValueChange={(v) => { setLinea((l) => ({ ...l, especieId: Number(v), variedadId: 0, categoriaId: null, calibreIds: [], articuloId: 0, etiquetaId: null })); resetCalibreRango() }}>
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
                  <Combobox
                    options={articulosLinea.map((a) => ({ value: String(a.id), label: `${a.codigo} — ${a.descripcion}` }))}
                    value={linea.articuloId ? String(linea.articuloId) : null}
                    onChange={(v) => {
                      const id = Number(v)
                      // Resolver etiqueta del nuevo artículo: FIJA (1 permitida) se
                      // autocompleta; si no, queda a elegir (DINÁMICA).
                      const art = (articulosData?.data ?? []).find((a) => a.id === id)
                      const permit = art
                        ? [...(art.etiqueta ? [art.etiqueta] : []), ...(art.etiquetasAdicionales ?? []).map((a) => a.etiqueta)]
                        : []
                      const etiquetaAuto = permit.length === 1 ? permit[0].id : null
                      setLinea((l) => ({ ...l, articuloId: id, etiquetaId: etiquetaAuto }))
                      void aplicarTeoricaCajas(id, linea.tipoPalletId)
                    }}
                    placeholder={linea.especieId ? 'Seleccionar...' : 'Elige una especie primero'}
                    searchPlaceholder='Buscar embalaje...'
                    disabled={!linea.especieId}
                  />
                  {lineaErrors.articuloId && <p className='text-xs text-destructive'>{lineaErrors.articuloId}</p>}
                </div>
                <div className='space-y-1.5'>
                  <Label>Etiqueta {etiquetasPermitidas.length > 1 && <span className='text-destructive'>*</span>}</Label>
                  {etiquetaFija ? (
                    <Input value={etiquetasPermitidas[0]?.descripcion ?? ''} disabled readOnly />
                  ) : (
                    <Select
                      value={linea.etiquetaId ? String(linea.etiquetaId) : ''}
                      onValueChange={(v) => setLinea((l) => ({ ...l, etiquetaId: Number(v) }))}
                      disabled={!articuloSeleccionado || etiquetasPermitidas.length === 0}
                    >
                      <SelectTrigger><SelectValue placeholder={articuloSeleccionado ? 'Seleccionar...' : 'Elige un embalaje primero'} /></SelectTrigger>
                      <SelectContent>
                        {etiquetasPermitidas.map((e) => (
                          <SelectItem key={e.id} value={String(e.id)}>{e.descripcion}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {lineaErrors.etiquetaId && <p className='text-xs text-destructive'>{lineaErrors.etiquetaId}</p>}
                </div>
                <div className='space-y-1.5'>
                  <Label>Tipo Pallet</Label>
                  <Select value={linea.tipoPalletId ? String(linea.tipoPalletId) : ''} onValueChange={(v) => { const id = v ? Number(v) : null; setLinea((l) => ({ ...l, tipoPalletId: id })); void aplicarTeoricaCajas(linea.articuloId, id) }}>
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
                      setLinea((l) => ({ ...l, cantidadPallets: v, cajas: v && cajasPorPalletValor ? String(Number(v) * cajasPorPalletValor) : l.cajas }))
                    }}
                  />
                  {lineaErrors.cantidadPallets && <p className='text-xs text-destructive'>{lineaErrors.cantidadPallets}</p>}
                </div>
                <div className='space-y-1.5'>
                  <Label>Cajas{cajasPorPalletValor > 0 ? ` (${cajasPorPalletValor} por pallet)` : ''} <span className='text-destructive'>*</span></Label>
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

              {linea.articuloId > 0 && linea.tipoPalletId == null && (
                <div className='flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-2'>
                  <Icons.alertCircle className='text-destructive h-4 w-4 shrink-0' />
                  <span className='text-destructive text-xs'>Selecciona el tipo de pallet para obtener la cantidad de cajas por pallet.</span>
                </div>
              )}
              {linea.articuloId > 0 && linea.tipoPalletId != null && cajasLookup === 'loading' && (
                <p className='text-muted-foreground text-xs'>Verificando cantidad de cajas por pallet…</p>
              )}
              {linea.articuloId > 0 && linea.tipoPalletId != null && cajasLookup === 'error' && (
                <div className='flex flex-wrap items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-2'>
                  <Icons.alertCircle className='text-destructive h-4 w-4 shrink-0' />
                  <span className='text-destructive text-xs'>No se pudo verificar la cantidad de cajas por pallet.</span>
                  <Button type='button' variant='outline' size='sm' onClick={() => void aplicarTeoricaCajas(linea.articuloId, linea.tipoPalletId)}>
                    <Icons.reopen className='mr-1 h-4 w-4' /> Reintentar
                  </Button>
                </div>
              )}
              {linea.articuloId > 0 && linea.tipoPalletId != null && cajasLookup === 'notFound' && (
                <div className='flex flex-wrap items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-2'>
                  <Icons.alertCircle className='text-destructive h-4 w-4 shrink-0' />
                  <span className='text-destructive text-xs'>No hay cantidad de cajas configurada para este embalaje y tipo de pallet.</span>
                  <CajasPorPalletQuickCreate
                    articuloId={linea.articuloId}
                    tipoPalletId={linea.tipoPalletId}
                    onCreated={aplicarCajasCreadas}
                  />
                </div>
              )}

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
                        <TableHead className='w-[110px]'>Artículo</TableHead>
                        <TableHead>Etiqueta</TableHead>
                        <TableHead>Categoría</TableHead>
                        <TableHead className='min-w-[240px]'>Calibre</TableHead>
                        <TableHead>Cantidad</TableHead>
                        <TableHead>Precio</TableHead>
                        <TableHead className='w-20 text-right'>Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {notaVenta!.data.detalles.map((d) => (
                        <TableRow key={d.id}>
                          <TableCell className='font-medium whitespace-nowrap'>{d.especie.descripcion} / {d.variedad.descripcion}</TableCell>
                          <TableCell className='w-[110px] max-w-[110px] truncate text-muted-foreground' title={d.articulo.descripcion}>{d.articulo.codigo}</TableCell>
                          <TableCell className='whitespace-nowrap text-muted-foreground'>{d.etiqueta?.descripcion ?? '—'}</TableCell>
                          <TableCell className='whitespace-nowrap text-muted-foreground'>{d.categoria?.descripcion ?? '—'}</TableCell>
                          <TableCell className='min-w-[240px] text-muted-foreground'>
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
                              <Button variant='ghost' size='icon' className='h-8 w-8' onClick={() => handleEditarLinea(d)} title='Editar'>
                                <Icons.edit className='h-4 w-4' />
                              </Button>
                              <Button variant='ghost' size='icon' className='h-8 w-8' onClick={() => handleDuplicarLinea(d)} title='Duplicar'>
                                <Icons.copy className='h-4 w-4' />
                              </Button>
                              <Button variant='ghost' size='icon' className='h-8 w-8' onClick={() => setDeleteDetalleId(d.id)} title='Eliminar'>
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
