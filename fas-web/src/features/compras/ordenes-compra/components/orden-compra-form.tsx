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
import { ExpandableText } from '@/components/shared/expandable-text'
import { MonedaQuickCreate } from '@/features/monedas/components/moneda-quick-create'
import type { MantenedorSimple, MantenedorSimpleListResponse } from '@/features/mantenedor-simple/types'
import { entidadesService } from '@/features/entidades/service'
import { articulosService } from '@/features/materiales/articulos/service'
import { cajasPorPalletService } from '@/features/cajas-por-pallet/service'
import { CajasPorPalletQuickCreate } from '@/features/cajas-por-pallet/components/cajas-por-pallet-quick-create'
import { notasVentaService } from '@/features/ventas/notas-venta/service'
import { usuariosService } from '@/features/usuarios/service'
import { condicionesPagoService } from '@/features/condiciones-pago/service'
import { CondicionPagoQuickCreate } from '@/features/condiciones-pago/components/condicion-pago-quick-create'
import { FECHA_REFERENCIA_LABELS } from '@/features/condiciones-pago/types'
import type { CondicionPago } from '@/features/condiciones-pago/types'
import { formatMonto } from '@/lib/format'
import { ordenCompraDetailOptions, ordenesCompraKeys } from '../queries'
import { ordenesCompraService } from '../service'
import type {
  OrdenCompraCreateInput,
  OrdenCompraLineaCreateInput,
  OrdenCompraLineaItem,
  EstadoOrdenCompra,
  ModalidadCompra,
  NotaVentaDetalleDisponibilidad,
} from '../types'
import { ESTADO_OC_LABELS, MODALIDAD_COMPRA_LABELS } from '../types'

const monedasService = createMantenedorService('monedas')
const especiesService = createMantenedorService('especies')
const variedadesService = createMantenedorService('variedades')
const categoriasService = createMantenedorService('categorias')
const calibresService = createMantenedorService('calibres')
const tiposPalletService = createMantenedorService('tipos-pallet')
const formasPagoService = createMantenedorService('formas-pago')
const mercadosService = createMantenedorService('mercados')
const clausulasVentaService = createMantenedorService('clausulas-venta')

// Cajas por pallet: cifra teórica del mantenedor CajasPorPallet (embalaje +
// tipo de pallet). Ya NO hay default 108 (2026-10-13): si la combinación no
// tiene cantidad configurada se marca error y se ofrece el alta inline.
type Origen = 'CIERRE' | 'MANUAL'

interface HeaderFields {
  origen: Origen
  modalidad: ModalidadCompra
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
  // Condiciones comerciales de compra a GRANEL (2026-10-27). Solo se usan y
  // muestran cuando la modalidad es Granel.
  porcentajeMinExportacion: string
  modalidadEntregaGranel: 'PUESTA_EN_CAMPO' | 'ENTREGADA_EN_PLANTA' | null
  envasesProporcionadosPor: 'PRODUCTOR' | 'EXPORTADORA' | null
  encargadoDescartePor: 'PRODUCTOR' | 'EXPORTADORA' | null
}

const HEADER_EMPTY: HeaderFields = {
  origen: 'MANUAL',
  modalidad: 'CAJAS',
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
  porcentajeMinExportacion: '',
  modalidadEntregaGranel: null,
  envasesProporcionadosPor: null,
  encargadoDescartePor: null,
}

const LINEA_EMPTY: OrdenCompraLineaCreateInput = {
  especieId: 0,
  variedadId: 0,
  categoriaId: 0,
  articuloId: 0,
  etiquetaId: null,
  calibreIds: [],
  tipoPalletId: null,
  cantidadPallets: 0,
  cajasPorPallet: 0,
  cajas: 0,
  precioUsdCaja: 0,
  cantidadKilos: null,
  precioUsdKilo: null,
  notaVentaDetalleId: null,
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
  const [linea, setLinea] = useState<OrdenCompraLineaCreateInput>(LINEA_EMPTY)
  const [lineaErrors, setLineaErrors] = useState<Record<string, string>>({})
  // Estado del lookup de cajas por pallet (2026-10-13, CPP-QA-003): distingue
  // "no configurada" (respuesta OK sin registro → alta inline) de un fallo
  // técnico (error → reintentar, sin ofrecer alta). Reemplaza el default 108.
  const [cajasLookup, setCajasLookup] = useState<'idle' | 'loading' | 'notFound' | 'error'>('idle')
  const [editingLineaId, setEditingLineaId] = useState<number | null>(null)
  const [deleteLineaId, setDeleteLineaId] = useState<number | null>(null)
  const [calibreDesdeId, setCalibreDesdeId] = useState<number | null>(null)
  const [calibreHastaId, setCalibreHastaId] = useState<number | null>(null)
  // Al usar una línea del Cierre el resto queda bloqueado y solo falta el
  // precio: saltamos el foco a ese campo.
  const precioInputRef = useRef<HTMLInputElement>(null)
  // Token para descartar respuestas obsoletas del lookup de cajas por pallet.
  const cajasReqRef = useRef(0)
  // Combinación visible actual: una respuesta del lookup solo se aplica si el
  // embalaje + tipo de pallet siguen siendo los consultados (CPP-QA, ronda 4) —
  // cubre editar/duplicar/cancelar/precargar mientras un lookup está en vuelo.
  const lineaRef = useRef(linea)
  useEffect(() => { lineaRef.current = linea }, [linea])
  // Grilla de líneas del Cierre Comercial: pallets a tomar por línea, antes
  // de "usar" (precargar el form de línea de abajo) — 2026-08-23.
  const [palletsPorLineaCierre, setPalletsPorLineaCierre] = useState<Record<number, string>>({})

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
  // Grilla de líneas del Cierre Comercial (2026-08-23) — solo tiene sentido
  // una vez creada la OC (isEdit, las líneas necesitan ordenCompraId) y con
  // un Cierre elegido.
  const { data: disponibilidadCierreData } = useQuery({
    queryKey: ['disponibilidad-cierre', fields.notaVentaId],
    queryFn: () => ordenesCompraService.getDisponibilidadCierre(fields.notaVentaId!),
    staleTime: 15_000,
    enabled: isEdit && fields.origen === 'CIERRE' && !!fields.notaVentaId,
  })
  const { data: responsablesData } = useQuery({
    queryKey: ['usuarios-responsables-venta-options'],
    queryFn: () => usuariosService.list({ limit: 500, esResponsableVenta: true }),
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
  // Artículos ofrecidos según la modalidad: EMBALAJE en Cajas (producto
  // terminado), GRANEL en Granel (2026-10-23).
  const { data: articulosData } = useQuery({ queryKey: ['articulos-oc-options', fields.modalidad], queryFn: () => articulosService.list({ limit: 500, tipo: fields.modalidad === 'GRANEL' ? 'GRANEL' : 'EMBALAJE', activo: true }), staleTime: 60_000 })
  const { data: variedadesData } = useQuery({ queryKey: ['variedades-options', linea.especieId], queryFn: () => variedadesService.list({ limit: 200, especieId: linea.especieId }), staleTime: 60_000, enabled: !!linea.especieId })
  const { data: categoriasData } = useQuery({ queryKey: ['categorias-options', linea.especieId], queryFn: () => categoriasService.list({ limit: 200, especieId: linea.especieId }), staleTime: 60_000, enabled: !!linea.especieId })
  const { data: calibresData } = useQuery({ queryKey: ['calibres-options', linea.especieId], queryFn: () => calibresService.list({ limit: 200, especieId: linea.especieId }), staleTime: 60_000, enabled: !!linea.especieId })
  const { data: tiposPalletData } = useQuery({ queryKey: ['tipos-pallet-options'], queryFn: () => tiposPalletService.list({ limit: 200 }), staleTime: 5 * 60_000 })

  const { data: incotermsData } = useQuery({ queryKey: ['clausulas-venta-options'], queryFn: () => clausulasVentaService.list({ limit: 200, soloActivos: true }), staleTime: 5 * 60_000 })

  const esGranel = fields.modalidad === 'GRANEL'
  // Código de la moneda elegida (CLP/USD/…) para las etiquetas de valor por
  // caja/kilo (2026-10-27) — ya no fijo "USD".
  const monedaCod = (monedasData?.data ?? []).find((m) => m.id === fields.monedaId)?.codigo || 'USD'
  // USD/EUR muestran el precio con 2 decimales; otras monedas (p.ej. CLP) sin decimales.
  const decimalesPrecio = monedaCod === 'USD' || monedaCod === 'EUR' ? 2 : 0
  // La modalidad (Cajas/Granel) solo se puede cambiar en Borrador y sin líneas
  // cargadas — cambiarla cambia qué campos exige cada línea (lo revalida el backend).
  const modalidadBloqueada = (ordenCompra?.data.lineas.length ?? 0) > 0 || fields.estado !== 'BORRADOR'

  const productores = productoresData?.data ?? []
  const responsables = responsablesData?.data ?? []
  const especies = especiesData?.data ?? []
  const articulos = articulosData?.data ?? []
  // Embalajes filtrados ESTRICTAMENTE por la especie de la línea (2026-10-14):
  // solo los de esa especie; los sin especie asignada NO aparecen nunca, y sin
  // especie elegida la lista queda vacía. La lista completa `articulos` se
  // conserva para resolver el artículo seleccionado (autofill de kg/etiqueta).
  const articulosLinea = linea.especieId
    ? articulos.filter((a) => a.especieId === linea.especieId)
    : []

  // Cuotas que se derivarán automáticamente al guardar (según Condición de Pago
  // seleccionada) — solo lectura, no se cargan manualmente.
  const condicionPagoSeleccionada = (condicionesPagoData?.data ?? []).find((c) => c.id === fields.condicionPagoId)
  const cuotasPreview = isEdit ? ordenCompra?.data.cuotasPago ?? [] : condicionPagoSeleccionada?.cuotas ?? []

  // FAS-OCNV-001 (QA ronda 1): bloquea el Origen/Cierre Comercial del
  // encabezado mientras la OC tenga líneas tomadas de un Cierre — cambiarlo
  // las dejaría huérfanas. El backend re-valida esto de forma autoritativa
  // (ordenes-compra.repository.ts updateOrdenCompra); esto es solo UX.
  const tieneLineasDeCierre = (ordenCompra?.data.lineas ?? []).some((l) => l.notaVentaDetalleId != null)

  useEffect(() => {
    if (ordenCompra) {
      const d = ordenCompra.data
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hidratación del form al cargar la OC a editar
      setFields({
        origen: d.notaVentaId ? 'CIERRE' : 'MANUAL',
        modalidad: d.modalidad,
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
        porcentajeMinExportacion: d.porcentajeMinExportacion != null ? String(d.porcentajeMinExportacion) : '',
        modalidadEntregaGranel: d.modalidadEntregaGranel ?? null,
        envasesProporcionadosPor: d.envasesProporcionadosPor ?? null,
        encargadoDescartePor: d.encargadoDescartePor ?? null,
      })
    }
  }, [ordenCompra])

  // Auto-fill: al elegir embalaje + tipo de pallet, precarga la cifra teórica
  // (editable). Se dispara solo por acción del usuario (no al cargar líneas de
  // un Cierre), para no pisar el cajasPorPallet que venga de ahí.
  async function aplicarTeoricaCajas(artId: number, tpId: number | null) {
    // Token de petición (CPP-QA-002): descarta respuestas obsoletas si el
    // usuario cambia embalaje/tipo de pallet antes de que resuelva el lookup.
    const token = ++cajasReqRef.current
    // Se limpia SIEMPRE al iniciar (CPP-QA-003): nunca se arrastra la cifra de
    // la combinación anterior — ni durante la carga ni si el lookup falla. Solo
    // una respuesta exitosa con cantidad vuelve a setearla. Sin default 108.
    setLinea((l) => ({ ...l, cajasPorPallet: 0, cajas: 0 }))
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
    if (token !== cajasReqRef.current) return // respuesta de una combinación anterior
    // La línea pudo cambiarse/reemplazarse (editar/duplicar/cancelar) mientras
    // el lookup estaba en vuelo: solo aplicar si la combinación visible coincide.
    if (lineaRef.current.articuloId !== artId || lineaRef.current.tipoPalletId !== tpId) return
    if (huboError) {
      // Error técnico: NO es "sin configuración". No se habilita el alta inline.
      setCajasLookup('error')
      return
    }
    if (teorica == null) {
      setCajasLookup('notFound') // respuesta OK sin registro → alta inline
      return
    }
    setCajasLookup('idle')
    setLinea((l) => ({ ...l, cajasPorPallet: teorica, cajas: l.cantidadPallets ? l.cantidadPallets * teorica : l.cajas }))
  }

  // La cantidad recién dada de alta inline se aplica igual que la teórica.
  function aplicarCajasCreadas(valor: number) {
    cajasReqRef.current++ // invalida cualquier lookup en vuelo
    setCajasLookup('idle')
    setLinea((l) => ({ ...l, cajasPorPallet: valor, cajas: l.cantidadPallets ? l.cantidadPallets * valor : l.cajas }))
  }

  // Descarta cualquier lookup de cajas en vuelo de forma SÍNCRONA (CPP-QA ronda
  // 5): se llama al reemplazar/descartar la línea (editar, precargar, cancelar,
  // guardar) para que una respuesta atrasada no se aplique a la línea nueva.
  function invalidarLookupCajas() {
    cajasReqRef.current++
    setCajasLookup('idle')
  }

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!fields.entidadProductorId) e.entidadProductorId = 'El productor es requerido'
    if (!fields.monedaId) e.monedaId = 'La moneda es requerida'
    if (fields.origen === 'CIERRE' && !fields.notaVentaId) e.notaVentaId = 'Selecciona el Cierre Comercial'
    // La Inspección de Compra ya no es requerida en la OC (2026-09-15).
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function buildPayload(): OrdenCompraCreateInput {
    return {
      entidadProductorId: fields.entidadProductorId,
      modalidad: fields.modalidad,
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
      // Condiciones de granel: solo se envían con valor en modalidad Granel; en
      // Cajas van null (el backend igual las nulifica).
      porcentajeMinExportacion: esGranel && fields.porcentajeMinExportacion.trim() !== '' ? Number(fields.porcentajeMinExportacion) : null,
      modalidadEntregaGranel: esGranel ? fields.modalidadEntregaGranel : null,
      envasesProporcionadosPor: esGranel ? fields.envasesProporcionadosPor : null,
      encargadoDescartePor: esGranel ? fields.encargadoDescartePor : null,
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

  // FAS-OCNV-005 (QA ronda 3): agregar/editar/eliminar una línea cambia el
  // disponible de la línea del Cierre que haya quedado comprometida — la
  // grilla de disponibilidad se sirve de una query aparte
  // (['disponibilidad-cierre', notaVentaId]) que no queda invalidada solo con
  // invalidar el detalle de la OC. El backend igual revalida el disponible de
  // forma atómica en cada mutación (no es un riesgo de integridad), esto es
  // solo para que la UI no muestre un disponible obsoleto.
  function invalidarDisponibilidadCierre() {
    if (fields.notaVentaId != null) {
      queryClient.invalidateQueries({ queryKey: ['disponibilidad-cierre', fields.notaVentaId] })
    }
    setPalletsPorLineaCierre({})
  }

  const addLineaMutation = useMutation({
    mutationFn: (data: OrdenCompraLineaCreateInput) => ordenesCompraService.addLinea(ordenCompraId!, data),
    onSuccess: () => {
      toast.success('Línea agregada')
      setLinea(LINEA_EMPTY)
      invalidarLookupCajas()
      setLineaErrors({})
      resetCalibreRango()
      queryClient.invalidateQueries({ queryKey: ordenesCompraKeys.detail(ordenCompraId!) })
      invalidarDisponibilidadCierre()
    },
    onError: (e: Error) => toast.error(e.message || 'Error al agregar la línea'),
  })

  const updateLineaMutation = useMutation({
    mutationFn: (data: OrdenCompraLineaCreateInput) => ordenesCompraService.updateLinea(ordenCompraId!, editingLineaId!, data),
    onSuccess: () => {
      toast.success('Línea actualizada')
      setLinea(LINEA_EMPTY)
      invalidarLookupCajas()
      setLineaErrors({})
      setEditingLineaId(null)
      resetCalibreRango()
      queryClient.invalidateQueries({ queryKey: ordenesCompraKeys.detail(ordenCompraId!) })
      invalidarDisponibilidadCierre()
    },
    onError: (e: Error) => toast.error(e.message || 'Error al actualizar la línea'),
  })

  const removeLineaMutation = useMutation({
    mutationFn: (lineaId: number) => ordenesCompraService.removeLinea(ordenCompraId!, lineaId),
    onSuccess: () => {
      toast.success('Línea eliminada')
      setDeleteLineaId(null)
      queryClient.invalidateQueries({ queryKey: ordenesCompraKeys.detail(ordenCompraId!) })
      invalidarDisponibilidadCierre()
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
    if (!linea.articuloId) e.articuloId = 'Requerido'
    if (esGranel) {
      // Granel: solo kilos + precio por kilo.
      if (!linea.cantidadKilos || linea.cantidadKilos <= 0) e.cantidadKilos = 'Debe ser mayor a 0'
      if ((linea.precioUsdKilo ?? 0) < 0) e.precioUsdKilo = 'No puede ser negativo'
    } else {
      if (!linea.categoriaId) e.categoriaId = 'Requerida'
      // Etiqueta: obligatoria solo si el artículo es dinámico (>1 permitida). Si es
      // fija, el backend la autocompleta aunque venga null.
      if (etiquetasPermitidas.length > 1 && !linea.etiquetaId) e.etiquetaId = 'Selecciona la etiqueta'
      if ((linea.calibreIds?.length ?? 0) === 0) e.calibreIds = 'Selecciona al menos un calibre'
      if (!linea.cantidadPallets || linea.cantidadPallets <= 0) e.cantidadPallets = 'Debe ser mayor a 0'
      // Cajas por pallet debe venir del mantenedor (sin default 108): si falta,
      // se bloquea el alta con un mensaje claro (lo refuerza el aviso de arriba).
      if (!linea.cajasPorPallet || linea.cajasPorPallet <= 0) e.cajasPorPallet = 'Falta la cantidad de cajas por pallet (elige tipo de pallet y configúrala)'
      if (!linea.cajas || linea.cajas <= 0) e.cajas = 'Debe ser mayor a 0'
      if ((linea.precioUsdCaja ?? 0) < 0) e.precioUsdCaja = 'No puede ser negativo'
    }
    setLineaErrors(e)
    return Object.keys(e).length === 0
  }

  function handleGuardarLinea() {
    if (!validarLinea()) return
    // En granel solo se envían los campos de granel; en cajas, los de cajas. Así
    // no viaja basura de la otra modalidad (el backend igual la nulifica).
    const payload: OrdenCompraLineaCreateInput = esGranel
      ? {
          especieId: linea.especieId,
          variedadId: linea.variedadId,
          articuloId: linea.articuloId,
          cantidadKilos: Number(linea.cantidadKilos),
          precioUsdKilo: Number(linea.precioUsdKilo ?? 0),
          notaVentaDetalleId: null,
        }
      : { ...linea, notaVentaDetalleId: linea.notaVentaDetalleId ?? null }
    if (editingLineaId) updateLineaMutation.mutate(payload)
    else addLineaMutation.mutate(payload)
  }

  function handleEditarLinea(l: OrdenCompraLineaItem) {
    setEditingLineaId(l.id)
    setLinea({
      especieId: l.especieId,
      variedadId: l.variedadId,
      categoriaId: l.categoriaId,
      articuloId: l.articuloId,
      etiquetaId: l.etiquetaId,
      calibreIds: l.calibres.map((c) => c.calibre.id),
      tipoPalletId: l.tipoPalletId,
      cantidadPallets: l.cantidadPallets,
      cajasPorPallet: l.cajasPorPallet,
      cajas: l.cajas,
      precioUsdCaja: l.precioUsdCaja != null ? Number(l.precioUsdCaja) : null,
      cantidadKilos: l.cantidadKilos != null ? Number(l.cantidadKilos) : null,
      precioUsdKilo: l.precioUsdKilo != null ? Number(l.precioUsdKilo) : null,
      notaVentaDetalleId: l.notaVentaDetalleId,
    })
    invalidarLookupCajas()
    setLineaErrors({})
    resetCalibreRango()
  }

  // Duplicar (2026-10-14): precarga el form de línea con los datos de una línea
  // existente SIN marcar edición → al "Agregar línea" se crea una nueva. El
  // usuario ajusta solo lo que necesite.
  function handleDuplicarLinea(l: OrdenCompraLineaItem) {
    setEditingLineaId(null)
    setLinea({
      especieId: l.especieId,
      variedadId: l.variedadId,
      categoriaId: l.categoriaId,
      articuloId: l.articuloId,
      etiquetaId: l.etiquetaId,
      calibreIds: l.calibres.map((c) => c.calibre.id),
      tipoPalletId: l.tipoPalletId,
      cantidadPallets: l.cantidadPallets,
      cajasPorPallet: l.cajasPorPallet,
      cajas: l.cajas,
      precioUsdCaja: l.precioUsdCaja != null ? Number(l.precioUsdCaja) : null,
      cantidadKilos: l.cantidadKilos != null ? Number(l.cantidadKilos) : null,
      precioUsdKilo: l.precioUsdKilo != null ? Number(l.precioUsdKilo) : null,
      notaVentaDetalleId: l.notaVentaDetalleId,
    })
    invalidarLookupCajas()
    setLineaErrors({})
    resetCalibreRango()
  }

  // Precarga el form de línea (de abajo) desde una línea del Cierre
  // Comercial — especie/variedad/categoría/artículo/tipoPallet/calibres
  // quedan bloqueados (se re-validan server-side de todos modos); el precio
  // sigue en blanco, es 100% manual (2026-08-23). `cajas` se recibe explícito
  // (no se recalcula como pallets × cajasPorPallet) para soportar el último
  // pallet parcial (FAS-OCNV-003, QA ronda 2/arbitraje) — sigue editable
  // después en "Cantidad de Cajas", como cualquier línea.
  function usarLineaCierre(detalle: NotaVentaDetalleDisponibilidad, pallets: number, cajas: number) {
    setEditingLineaId(null)
    setLinea({
      especieId: detalle.especieId,
      variedadId: detalle.variedadId,
      categoriaId: detalle.categoriaId ?? 0,
      articuloId: detalle.articuloId,
      // Precarga la etiqueta (Marca) del Cierre como valor inicial; editable y
      // re-validada contra el set permitido del artículo (2026-10-18).
      etiquetaId: detalle.etiquetaId,
      calibreIds: detalle.calibres.map((c) => c.calibre.id),
      tipoPalletId: detalle.tipoPalletId,
      cantidadPallets: pallets,
      cajasPorPallet: detalle.cajasPorPallet,
      cajas,
      precioUsdCaja: 0,
      notaVentaDetalleId: detalle.id,
    })
    invalidarLookupCajas()
    setLineaErrors({})
    resetCalibreRango()
    // Tras pintar la línea precargada, lleva el foco al Valor (único campo que
    // falta) y lo trae a la vista.
    requestAnimationFrame(() => {
      precioInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      precioInputRef.current?.focus({ preventScroll: true })
    })
  }

  function handleCancelarEdicionLinea() {
    setEditingLineaId(null)
    setLinea(LINEA_EMPTY)
    invalidarLookupCajas()
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
    setLinea((l) => ({ ...l, calibreIds: Array.from(new Set([...(l.calibreIds ?? []), ...nuevos])) }))
    resetCalibreRango()
  }

  if (isEdit && isLoading) {
    return <p className='text-sm text-muted-foreground'>Cargando…</p>
  }

  const isPending = createMutation.isPending || updateMutation.isPending
  const yaRecepcionada = ordenCompra?.data.estado === 'RECEPCIONADA'
  const soloLectura = !puedeEscribir || yaRecepcionada
  const articuloSeleccionado = articulos.find((a) => a.id === linea.articuloId)
  // Set de etiquetas permitido del artículo = principal ∪ adicionales. FIJA (1)
  // → se autocompleta y queda de solo lectura; DINÁMICA (>1) → se elige.
  const etiquetasPermitidas = articuloSeleccionado
    ? [
        ...(articuloSeleccionado.etiqueta ? [articuloSeleccionado.etiqueta] : []),
        ...(articuloSeleccionado.etiquetasAdicionales ?? []).map((a) => a.etiqueta),
      ]
    : []
  const etiquetaFija = etiquetasPermitidas.length === 1
  const lineaMutationPending = addLineaMutation.isPending || updateLineaMutation.isPending
  // Línea tomada de una línea del Cierre Comercial (2026-08-23): especie/
  // variedad/categoría/artículo/tipoPallet quedan bloqueados en el form —
  // el backend los re-copia de todos modos, esto solo evita que el usuario
  // los toque y se lleve una sorpresa al guardar.
  const lineaBloqueadaPorCierre = !!linea.notaVentaDetalleId

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
          {/* Modalidad de compra (Cajas / Granel) */}
          <div className='grid gap-4 sm:grid-cols-3'>
            <div className='space-y-1.5'>
              <Label>Modalidad</Label>
              <Select
                value={fields.modalidad}
                disabled={modalidadBloqueada}
                onValueChange={(v) => {
                  const m = v as ModalidadCompra
                  setFields((f) => ({ ...f, modalidad: m, ...(m === 'GRANEL' ? { origen: 'MANUAL' as Origen, notaVentaId: null } : {}) }))
                  // Cambiar la modalidad reinicia el formulario de línea (sus
                  // campos cambian por completo).
                  setLinea(LINEA_EMPTY)
                  setEditingLineaId(null)
                  setLineaErrors({})
                  resetCalibreRango()
                  invalidarLookupCajas()
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(MODALIDAD_COMPRA_LABELS) as ModalidadCompra[]).map((m) => (
                    <SelectItem key={m} value={m}>{MODALIDAD_COMPRA_LABELS[m]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className='text-xs text-muted-foreground'>
                {modalidadBloqueada
                  ? 'Solo se puede cambiar en Borrador y sin líneas cargadas.'
                  : 'Cajas: fruta embalada (producto terminado). Granel: compra por kilos.'}
              </p>
            </div>
          </div>

          <Separator />

          {/* Fila 1: Origen + Cierre Comercial (si aplica) + Fecha */}
          <div className={`grid gap-4 sm:grid-cols-2 ${fields.origen === 'CIERRE' ? 'md:grid-cols-3' : ''}`}>
            <div className='space-y-1.5'>
              <Label>Origen</Label>
              <Select
                value={fields.origen}
                disabled={tieneLineasDeCierre || esGranel}
                onValueChange={(v) => setFields((f) => ({ ...f, origen: v as Origen, notaVentaId: v === 'MANUAL' ? null : f.notaVentaId }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value='CIERRE'>Cierre Comercial</SelectItem>
                  <SelectItem value='MANUAL'>Manual</SelectItem>
                </SelectContent>
              </Select>
              {tieneLineasDeCierre && (
                <p className='text-xs text-muted-foreground'>
                  No se puede cambiar: tiene líneas tomadas de este Cierre Comercial (elimínelas primero).
                </p>
              )}
            </div>
            {fields.origen === 'CIERRE' && (
              <div className='space-y-1.5'>
                <Label>Cierre Comercial</Label>
                <Select
                  value={fields.notaVentaId ? String(fields.notaVentaId) : ''}
                  disabled={tieneLineasDeCierre}
                  onValueChange={(v) => setFields((f) => ({ ...f, notaVentaId: Number(v) }))}
                >
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

          <Separator />

          {/* Fila 3: Condición de pago + Forma de pago + Moneda */}
          <div className='grid gap-4 sm:grid-cols-3'>
            <div className='space-y-1.5'>
              <Label>Condición de Pago</Label>
              <div className='flex gap-2'>
                <Select value={fields.condicionPagoId ? String(fields.condicionPagoId) : '__none__'} onValueChange={(v) => setFields((f) => ({ ...f, condicionPagoId: v === '__none__' ? null : Number(v) }))}>
                  <SelectTrigger className='flex-1'><SelectValue placeholder='Sin definir' /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value='__none__'>Sin definir</SelectItem>
                    {(condicionesPagoData?.data ?? []).map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.descripcion}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <CondicionPagoQuickCreate
                  defaultTipo='COMPRA'
                  onCreated={(c) => {
                    queryClient.setQueryData<{ data: CondicionPago[] }>(['condiciones-pago-options', 'COMPRA'], (old) =>
                      old ? { ...old, data: [...old.data, c] } : old,
                    )
                    setFields((f) => ({ ...f, condicionPagoId: c.id }))
                  }}
                />
              </div>
            </div>
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
            <div className='space-y-1.5'>
              <Label>Incoterm</Label>
              <div className='flex gap-2'>
                <Select value={fields.incotermId ? String(fields.incotermId) : '__none__'} onValueChange={(v) => setFields((f) => ({ ...f, incotermId: v === '__none__' ? null : Number(v) }))}>
                  <SelectTrigger className='flex-1'><SelectValue placeholder='Sin definir' /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value='__none__'>Sin definir</SelectItem>
                    {(incotermsData?.data ?? []).map((i) => (
                      <SelectItem key={i.id} value={String(i.id)}>{i.descripcion}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <MantenedorQuickCreate
                  recurso='clausulas-venta'
                  titulo='Incoterm'
                  onCreated={(i) => {
                    agregarAOpciones(['clausulas-venta-options'], i)
                    setFields((f) => ({ ...f, incotermId: i.id }))
                  }}
                />
              </div>
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

          {/* Condiciones comerciales de compra a Granel (2026-10-27) */}
          {esGranel && (
            <>
              <Separator />
              <div className='grid gap-4 sm:grid-cols-2'>
                <div className='space-y-1.5'>
                  <Label>% mínimo de exportación</Label>
                  <Input
                    type='number'
                    min={0}
                    max={100}
                    step='0.01'
                    value={fields.porcentajeMinExportacion}
                    onChange={(e) => setFields((f) => ({ ...f, porcentajeMinExportacion: e.target.value }))}
                    placeholder='Ej: 80'
                  />
                </div>
                <div className='space-y-1.5'>
                  <Label>Modalidad de entrega</Label>
                  <Select value={fields.modalidadEntregaGranel ?? '__none__'} onValueChange={(v) => setFields((f) => ({ ...f, modalidadEntregaGranel: v === '__none__' ? null : (v as HeaderFields['modalidadEntregaGranel']) }))}>
                    <SelectTrigger><SelectValue placeholder='Sin definir' /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value='__none__'>— Sin definir —</SelectItem>
                      <SelectItem value='PUESTA_EN_CAMPO'>Fruta puesta en campo, con retiro por la exportadora</SelectItem>
                      <SelectItem value='ENTREGADA_EN_PLANTA'>Fruta entregada en la planta de proceso</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className='space-y-1.5'>
                  <Label>Envases proporcionados por</Label>
                  <Select value={fields.envasesProporcionadosPor ?? '__none__'} onValueChange={(v) => setFields((f) => ({ ...f, envasesProporcionadosPor: v === '__none__' ? null : (v as HeaderFields['envasesProporcionadosPor']) }))}>
                    <SelectTrigger><SelectValue placeholder='Sin definir' /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value='__none__'>— Sin definir —</SelectItem>
                      <SelectItem value='PRODUCTOR'>Productor</SelectItem>
                      <SelectItem value='EXPORTADORA'>Exportadora</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className='space-y-1.5'>
                  <Label>Encargado de descarte</Label>
                  <Select value={fields.encargadoDescartePor ?? '__none__'} onValueChange={(v) => setFields((f) => ({ ...f, encargadoDescartePor: v === '__none__' ? null : (v as HeaderFields['encargadoDescartePor']) }))}>
                    <SelectTrigger><SelectValue placeholder='Sin definir' /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value='__none__'>— Sin definir —</SelectItem>
                      <SelectItem value='PRODUCTOR'>Productor</SelectItem>
                      <SelectItem value='EXPORTADORA'>Exportadora</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
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
            {fields.origen === 'CIERRE' && fields.notaVentaId && (
              <div className='space-y-2'>
                <Label>Líneas del Cierre Comercial</Label>
                <p className='text-xs text-muted-foreground'>
                  Selecciona cuántos pallets tomar de cada línea (completa o parcial) — precarga el formulario de
                  abajo con especie/variedad/categoría/artículo/calibres bloqueados; solo falta el precio.
                </p>
                <div className='overflow-x-auto rounded-md border'>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Especie / Variedad</TableHead>
                        <TableHead>Embalaje</TableHead>
                        <TableHead>Categoría</TableHead>
                        <TableHead>Calibres</TableHead>
                        <TableHead>Disponible</TableHead>
                        <TableHead className='w-40'>Pallets a tomar</TableHead>
                        <TableHead className='w-24 text-right'>Acción</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(disponibilidadCierreData?.data ?? []).map((d) => {
                        const palletsDisponibles = d.cajasPorPallet > 0 ? Math.floor(d.cajasDisponibles / d.cajasPorPallet) : 0
                        // Disponible menor a 1 pallet completo (FAS-OCNV-003,
                        // QA ronda 2/arbitraje): compras.md §4.3 permite un
                        // último pallet parcial — no se puede dejar ese resto
                        // inalcanzable solo porque no llena un pallet.
                        const soloRemanente = palletsDisponibles === 0 && d.cajasDisponibles > 0
                        const palletsStr = palletsPorLineaCierre[d.id] ?? ''
                        const pallets = Number(palletsStr) || 0
                        const puedeUsar = d.categoriaId != null && (soloRemanente || (pallets > 0 && pallets <= palletsDisponibles))
                        return (
                          <TableRow key={d.id}>
                            <TableCell className='font-medium whitespace-nowrap'>{d.especie.descripcion} / {d.variedad.descripcion}</TableCell>
                            <TableCell className='whitespace-nowrap text-muted-foreground'>{d.articulo.codigo}</TableCell>
                            <TableCell className='whitespace-nowrap text-muted-foreground'>{d.categoria?.descripcion ?? '—'}</TableCell>
                            <TableCell className='max-w-[180px] align-top text-muted-foreground'>
                              <ExpandableText text={d.calibres.map((c) => c.calibre.descripcion).join(', ')} max={24} />
                            </TableCell>
                            <TableCell className='whitespace-nowrap text-muted-foreground'>
                              {palletsDisponibles} pallets ({d.cajasDisponibles} cajas)
                            </TableCell>
                            <TableCell>
                              {soloRemanente ? (
                                <span className='text-xs text-muted-foreground'>Resto: {d.cajasDisponibles} cajas (&lt; 1 pallet)</span>
                              ) : (
                                <Input
                                  type='number'
                                  min={0}
                                  max={palletsDisponibles}
                                  value={palletsStr}
                                  onChange={(e) => setPalletsPorLineaCierre((prev) => ({ ...prev, [d.id]: e.target.value }))}
                                  disabled={palletsDisponibles === 0 || d.categoriaId == null}
                                />
                              )}
                            </TableCell>
                            <TableCell className='text-right'>
                              <Button
                                type='button'
                                variant='secondary'
                                size='sm'
                                disabled={!puedeUsar}
                                onClick={() =>
                                  usarLineaCierre(d, soloRemanente ? 1 : pallets, soloRemanente ? d.cajasDisponibles : pallets * d.cajasPorPallet)
                                }
                              >
                                Usar
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                      {(disponibilidadCierreData?.data ?? []).length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className='text-center text-muted-foreground'>
                            Este Cierre Comercial no tiene líneas de detalle.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
            <div className='space-y-3'>
              {lineaBloqueadaPorCierre && (
                <Badge variant='outline'>Línea del Cierre Comercial — especie/variedad/categoría/artículo/calibres bloqueados</Badge>
              )}
              {/* Fila 1: Especie, Embalaje (2 columnas) */}
              <div className='grid gap-3 sm:grid-cols-2 md:grid-cols-3'>
                <div className='space-y-1.5'>
                  <Label>Especie <span className='text-destructive'>*</span></Label>
                  <Select
                    value={linea.especieId ? String(linea.especieId) : ''}
                    onValueChange={(v) => { setLinea((l) => ({ ...l, especieId: Number(v), variedadId: 0, categoriaId: 0, calibreIds: [], articuloId: 0, etiquetaId: null })); resetCalibreRango() }}
                    disabled={lineaBloqueadaPorCierre}
                  >
                    <SelectTrigger><SelectValue placeholder='Seleccionar...' /></SelectTrigger>
                    <SelectContent>
                      {especies.map((e) => (
                        <SelectItem key={e.id} value={String(e.id)}>{e.descripcion}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {lineaErrors.especieId && <p className='text-xs text-destructive'>{lineaErrors.especieId}</p>}
                </div>
                <div className='space-y-1.5'>
                  <Label>{esGranel ? 'Artículo (Granel)' : 'Embalaje'} <span className='text-destructive'>*</span></Label>
                  <Combobox
                    options={articulosLinea.map((a) => ({ value: String(a.id), label: `${a.codigo} — ${a.descripcion}` }))}
                    value={linea.articuloId ? String(linea.articuloId) : null}
                    onChange={(v) => {
                      const id = Number(v)
                      if (esGranel) {
                        setLinea((l) => ({ ...l, articuloId: id, etiquetaId: null }))
                        return
                      }
                      // Resolver la etiqueta del nuevo artículo: si tiene una sola
                      // permitida (FIJA) se autocompleta; si no, queda a elegir.
                      const art = articulos.find((a) => a.id === id)
                      const permit = art
                        ? [...(art.etiqueta ? [art.etiqueta] : []), ...(art.etiquetasAdicionales ?? []).map((a) => a.etiqueta)]
                        : []
                      const etiquetaAuto = permit.length === 1 ? permit[0].id : null
                      setLinea((l) => ({ ...l, articuloId: id, etiquetaId: etiquetaAuto }))
                      void aplicarTeoricaCajas(id, linea.tipoPalletId ?? null)
                    }}
                    placeholder={linea.especieId ? 'Seleccionar...' : 'Elige una especie primero'}
                    searchPlaceholder={esGranel ? 'Buscar artículo...' : 'Buscar embalaje...'}
                    disabled={lineaBloqueadaPorCierre || !linea.especieId}
                  />
                  {lineaErrors.articuloId && <p className='text-xs text-destructive'>{lineaErrors.articuloId}</p>}
                </div>
                {!esGranel && (
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
                        <SelectTrigger>
                          <SelectValue placeholder={articuloSeleccionado ? 'Seleccionar...' : 'Elige un embalaje primero'} />
                        </SelectTrigger>
                        <SelectContent>
                          {etiquetasPermitidas.map((e) => (
                            <SelectItem key={e.id} value={String(e.id)}>{e.descripcion}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    {lineaErrors.etiquetaId && <p className='text-xs text-destructive'>{lineaErrors.etiquetaId}</p>}
                  </div>
                )}
              </div>

              {/* Fila 2: Variedad, Categoría */}
              <div className='grid gap-3 sm:grid-cols-2 md:grid-cols-3'>
                <div className='space-y-1.5'>
                  <Label>Variedad <span className='text-destructive'>*</span></Label>
                  <Select
                    value={linea.variedadId ? String(linea.variedadId) : ''}
                    onValueChange={(v) => setLinea((l) => ({ ...l, variedadId: Number(v) }))}
                    disabled={!linea.especieId || lineaBloqueadaPorCierre}
                  >
                    <SelectTrigger><SelectValue placeholder='Seleccionar...' /></SelectTrigger>
                    <SelectContent>
                      {(variedadesData?.data ?? []).map((v) => (
                        <SelectItem key={v.id} value={String(v.id)}>{v.descripcion}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {lineaErrors.variedadId && <p className='text-xs text-destructive'>{lineaErrors.variedadId}</p>}
                </div>
                {!esGranel && (
                  <div className='space-y-1.5'>
                    <Label>Categoría <span className='text-destructive'>*</span></Label>
                    <Select
                      value={linea.categoriaId ? String(linea.categoriaId) : ''}
                      onValueChange={(v) => setLinea((l) => ({ ...l, categoriaId: Number(v) }))}
                      disabled={!linea.especieId || lineaBloqueadaPorCierre}
                    >
                      <SelectTrigger><SelectValue placeholder='Seleccionar...' /></SelectTrigger>
                      <SelectContent>
                        {(categoriasData?.data ?? []).map((c) => (
                          <SelectItem key={c.id} value={String(c.id)}>{c.descripcion}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {lineaErrors.categoriaId && <p className='text-xs text-destructive'>{lineaErrors.categoriaId}</p>}
                  </div>
                )}
              </div>

              {/* Calibres: solo en modalidad CAJAS (en granel no aplican). */}
              {!esGranel && (<>
              {/* Fila 3: Calibre Inicio, Calibre Fin, Agregar — deshabilitado
                  si la línea viene del Cierre: los calibres ya se precargan
                  completos y solo se pueden QUITAR (mantiene el subconjunto
                  exigido por el backend), no agregar otros fuera de la lista. */}
              <div className='grid gap-3 sm:grid-cols-2 md:grid-cols-3'>
                <div className='min-w-0 space-y-1.5'>
                  <Label>Calibre Inicio</Label>
                  <Select value={calibreDesdeId ? String(calibreDesdeId) : ''} onValueChange={(v) => setCalibreDesdeId(Number(v))} disabled={!linea.especieId || lineaBloqueadaPorCierre}>
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
                  <Select value={calibreHastaId ? String(calibreHastaId) : ''} onValueChange={(v) => setCalibreHastaId(Number(v))} disabled={!linea.especieId || lineaBloqueadaPorCierre}>
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
                  <Button type='button' variant='secondary' className='w-full' onClick={agregarRangoCalibre} disabled={!linea.especieId || !calibreDesdeId || lineaBloqueadaPorCierre}>
                    <Icons.add className='mr-1 h-4 w-4' /> Agregar
                  </Button>
                </div>
              </div>

              <div className='space-y-1.5'>
                <Label>Calibres <span className='text-destructive'>*</span></Label>
                {(linea.calibreIds ?? []).length > 0 ? (
                  <div className='flex flex-wrap gap-1.5'>
                    {(linea.calibreIds ?? []).map((id) => {
                      const opt = (calibresData?.data ?? []).find((c) => c.id === id)
                      return (
                        <Badge key={id} variant='secondary' className='gap-1 pr-1'>
                          {opt?.descripcion ?? id}
                          <button
                            type='button'
                            onClick={() => setLinea((l) => ({ ...l, calibreIds: (l.calibreIds ?? []).filter((x) => x !== id) }))}
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
              </>)}

              {/* Fila 4 (CAJAS): Tipo Pallet, Cant. Pallets, Cantidad de Cajas */}
              {!esGranel && (<>
              <div className='grid gap-3 sm:grid-cols-2 md:grid-cols-3'>
                <div className='space-y-1.5'>
                  <Label>Tipo Pallet</Label>
                  <Select
                    value={linea.tipoPalletId ? String(linea.tipoPalletId) : '__none__'}
                    onValueChange={(v) => { const id = v === '__none__' ? null : Number(v); setLinea((l) => ({ ...l, tipoPalletId: id })); void aplicarTeoricaCajas(linea.articuloId, id) }}
                    disabled={lineaBloqueadaPorCierre}
                  >
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
                      // Usa el cajasPorPallet ya guardado en la línea (el de
                      // la línea del Cierre si viene de ahí, el default si
                      // es manual) — no el default a secas.
                      setLinea((l) => ({ ...l, cantidadPallets: pallets, cajas: v ? pallets * (l.cajasPorPallet ?? 0) : l.cajas }))
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
                  <Button type='button' variant='outline' size='sm' onClick={() => void aplicarTeoricaCajas(linea.articuloId, linea.tipoPalletId ?? null)}>
                    <Icons.reopen className='mr-1 h-4 w-4' /> Reintentar
                  </Button>
                </div>
              )}
              {linea.articuloId > 0 && linea.tipoPalletId != null && cajasLookup === 'notFound' && (
                <div className='flex flex-wrap items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-2'>
                  <Icons.alertCircle className='text-destructive h-4 w-4 shrink-0' />
                  <span className='text-destructive text-xs'>No hay cantidad de cajas configurada para este embalaje y tipo de pallet.</span>
                  {!lineaBloqueadaPorCierre && (
                    <CajasPorPalletQuickCreate
                      articuloId={linea.articuloId}
                      tipoPalletId={linea.tipoPalletId}
                      onCreated={aplicarCajasCreadas}
                    />
                  )}
                </div>
              )}

              {/* Fila 5: Valor USD/Caja */}
              <div className='grid gap-3 sm:grid-cols-2 md:grid-cols-3'>
                <div className='space-y-1.5'>
                  <Label>Valor ({monedaCod}/Caja)</Label>
                  <Input ref={precioInputRef} type='number' step='0.01' value={linea.precioUsdCaja || ''} onChange={(e) => setLinea((l) => ({ ...l, precioUsdCaja: Number(e.target.value) }))} />
                  {lineaErrors.precioUsdCaja && <p className='text-xs text-destructive'>{lineaErrors.precioUsdCaja}</p>}
                </div>
              </div>
              </>)}

              {/* GRANEL: Kilos + Precio USD/Kg (2026-10-23) */}
              {esGranel && (
                <div className='grid gap-3 sm:grid-cols-2 md:grid-cols-3'>
                  <div className='space-y-1.5'>
                    <Label>Kilos <span className='text-destructive'>*</span></Label>
                    <Input
                      type='number'
                      step='0.01'
                      value={linea.cantidadKilos ?? ''}
                      onChange={(e) => setLinea((l) => ({ ...l, cantidadKilos: e.target.value ? Number(e.target.value) : null }))}
                    />
                    {lineaErrors.cantidadKilos && <p className='text-xs text-destructive'>{lineaErrors.cantidadKilos}</p>}
                  </div>
                  <div className='space-y-1.5'>
                    <Label>Valor ({monedaCod}/Kg) <span className='text-destructive'>*</span></Label>
                    <Input
                      ref={precioInputRef}
                      type='number'
                      step='0.0001'
                      value={linea.precioUsdKilo ?? ''}
                      onChange={(e) => setLinea((l) => ({ ...l, precioUsdKilo: e.target.value ? Number(e.target.value) : null }))}
                    />
                    {lineaErrors.precioUsdKilo && <p className='text-xs text-destructive'>{lineaErrors.precioUsdKilo}</p>}
                  </div>
                </div>
              )}
            </div>

            {articuloSeleccionado && (articuloSeleccionado.etiqueta || articuloSeleccionado.kgNetoEnvase) && (
              <p className='text-xs text-muted-foreground'>
                Etiqueta: {articuloSeleccionado.etiqueta?.descripcion ?? '—'} · Kg Neto: {articuloSeleccionado.kgNetoEnvase ?? '—'} · Kg Bruto: {articuloSeleccionado.kgBrutoEnvase ?? '—'}
              </p>
            )}
            {esGranel
              ? (linea.cantidadKilos ?? 0) > 0 && (
                  <p className='text-right text-sm text-muted-foreground'>
                    Total: {linea.cantidadKilos} kg × ${linea.precioUsdKilo || 0} = ${((linea.cantidadKilos ?? 0) * (linea.precioUsdKilo ?? 0)).toFixed(2)}
                  </p>
                )
              : (linea.cajas ?? 0) > 0 && (
                  <p className='text-right text-sm text-muted-foreground'>
                    Total: {linea.cajas} cajas × ${linea.precioUsdCaja || 0} = ${((linea.cajas ?? 0) * (linea.precioUsdCaja ?? 0)).toFixed(2)}
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
                        <TableHead className='w-[110px]'>Embalaje</TableHead>
                        <TableHead>Etiqueta</TableHead>
                        <TableHead>Categoría</TableHead>
                        <TableHead className='min-w-[240px]'>Calibre</TableHead>
                        <TableHead>Cantidad</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead className='w-20 text-right'>Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ordenCompra!.data.lineas.map((l) => (
                        <TableRow key={l.id}>
                          <TableCell className='font-medium whitespace-nowrap'>{l.especie.descripcion} / {l.variedad.descripcion}</TableCell>
                          <TableCell className='w-[110px] max-w-[110px] truncate text-muted-foreground' title={l.articulo.descripcion}>{l.articulo.codigo}</TableCell>
                          <TableCell className='whitespace-nowrap text-muted-foreground'>{l.etiqueta?.descripcion ?? l.articulo.etiqueta?.descripcion ?? '—'}</TableCell>
                          <TableCell className='whitespace-nowrap text-muted-foreground'>{l.categoria?.descripcion ?? '—'}</TableCell>
                          <TableCell className='min-w-[240px] text-muted-foreground'>
                            <div className='flex flex-wrap gap-1'>
                              {l.calibres.map((c) => (
                                <Badge key={c.calibre.id} variant='outline' className='text-xs'>{c.calibre.descripcion}</Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className='whitespace-nowrap text-muted-foreground'>{l.cantidadKilos != null ? `${formatMonto(l.cantidadKilos, 0)} kg` : `${formatMonto(l.cantidadPallets ?? 0, 0)} pallets · ${formatMonto(l.cajas ?? 0, 0)} cajas`}</TableCell>
                          <TableCell className='whitespace-nowrap text-muted-foreground'>{l.precioUsdKilo != null ? `$${formatMonto(l.precioUsdKilo, decimalesPrecio)}/kg` : `$${formatMonto(l.precioUsdCaja ?? 0, decimalesPrecio)}/cj`}</TableCell>
                          <TableCell className='text-right'>
                            <div className='flex justify-end gap-1'>
                              <Button type='button' variant='ghost' size='icon' className='h-8 w-8' onClick={() => handleEditarLinea(l)} title='Editar'>
                                <Icons.edit className='h-4 w-4' />
                              </Button>
                              <Button type='button' variant='ghost' size='icon' className='h-8 w-8' onClick={() => handleDuplicarLinea(l)} title='Duplicar'>
                                <Icons.copy className='h-4 w-4' />
                              </Button>
                              <Button type='button' variant='ghost' size='icon' className='h-8 w-8' onClick={() => setDeleteLineaId(l.id)} title='Eliminar'>
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

