'use client'

// Contrato de Productor en PANTALLA COMPLETA (2026-11-18, reemplaza el panel
// lateral ContratoFormSheet):
// - Condición de Pago por LÍNEA (antes en la cabecera), obligatoria.
// - Líneas con el mismo patrón que Instructivo/OC: formulario de línea arriba y
//   grilla abajo con Editar, Duplicar y Eliminar.
// - Documentos adjuntos (binario en BD): en edición se suben/eliminan al
//   instante; en un contrato nuevo se eligen antes de guardar y se suben al
//   crearlo.

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Combobox } from '@/components/ui/combobox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Icons } from '@/components/icons'
import { AlertModal } from '@/components/modal/alert-modal'
import { AvisoSinTemporada } from '@/components/shared/aviso-sin-temporada'
import { createMantenedorService } from '@/features/mantenedor-simple/service'
import { articulosService } from '@/features/materiales/articulos/service'
import { condicionesPagoService } from '@/features/condiciones-pago/service'
import { usuariosService } from '@/features/usuarios/service'
import { usePuedeEscribir } from '@/hooks/use-item-acceso'
import { useTemporada } from '@/contexts/temporada-context'
import { articuloDescripcionComercial } from '@/lib/articulo'
import { contratosService } from '../service'
import type { Contrato, ContratoAdjunto, ContratoLineaInput } from '../types'

const ITEM = 'PROD_CONTRATO'

const temporadasService = createMantenedorService('temporadas')
const especiesService = createMantenedorService('especies')
const variedadesService = createMantenedorService('variedades')
const categoriasService = createMantenedorService('categorias')
const calibresService = createMantenedorService('calibres')
const unidadesMedidaService = createMantenedorService('unidades-medida')

interface TemporadaOption {
  id: number
  codigo: string
  descripcion: string
  fechaInicio: string
  fechaTermino: string
}

type Ref = { id: number; codigo: string; descripcion: string }

// Línea en edición (inputs como string) y línea de la grilla (condicionPagoId
// puede venir null en contratos antiguos: se exige al guardar).
interface LineaForm {
  articuloId: number | null
  variedadId: number | null
  categoriaId: number | null
  calibreDesdeId: number | null
  calibreHastaId: number | null
  unidadMedidaId: number | null
  condicionPagoId: number | null
  cantidadComprometida: string
  minimoGarantizado: string
}
type LineaGrilla = Omit<ContratoLineaInput, 'condicionPagoId'> & { condicionPagoId: number | null }

const LINEA_VACIA: LineaForm = {
  articuloId: null,
  variedadId: null,
  categoriaId: null,
  calibreDesdeId: null,
  calibreHastaId: null,
  unidadMedidaId: null,
  condicionPagoId: null,
  cantidadComprometida: '',
  minimoGarantizado: '',
}

function aForm(l: LineaGrilla): LineaForm {
  return {
    articuloId: l.articuloId,
    variedadId: l.variedadId,
    categoriaId: l.categoriaId,
    calibreDesdeId: l.calibreDesdeId,
    calibreHastaId: l.calibreHastaId,
    unidadMedidaId: l.unidadMedidaId,
    condicionPagoId: l.condicionPagoId,
    cantidadComprometida: String(l.cantidadComprometida),
    minimoGarantizado: String(l.minimoGarantizado),
  }
}

const fmtNum = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 4 })

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const MAX_ADJUNTO_BYTES = 15 * 1024 * 1024

export function ContratoForm({ entidadId, contratoId }: { entidadId: number; contratoId?: number }) {
  const isEdit = contratoId != null
  const router = useRouter()
  const queryClient = useQueryClient()
  const puedeEscribir = usePuedeEscribir(ITEM)
  const volver = `/dashboard/productores/${entidadId}?tab=contrato`

  const { data: contratoData, isPending: contratoCargando } = useQuery({
    queryKey: ['productores', 'contrato', entidadId, contratoId],
    queryFn: () => contratosService.get(entidadId, contratoId!),
    enabled: isEdit,
  })
  const item: Contrato | undefined = contratoData?.data

  // Temporada: al crear, la del selector superior; al editar, la del contrato.
  const { temporada: temporadaActiva, isLoading: temporadaCargando } = useTemporada()
  const temporadaId = isEdit ? item?.temporadaId ?? null : temporadaActiva?.id ?? null
  const temporadaCodigo = isEdit ? item?.temporada?.codigo : temporadaActiva?.codigo
  const sinTemporada = !isEdit && temporadaId == null

  const [especieId, setEspecieId] = useState<number | null>(null)
  const [fechaInicio, setFechaInicio] = useState('')
  const [fechaTermino, setFechaTermino] = useState('')
  const [fechasTocadas, setFechasTocadas] = useState(false)
  const [responsableId, setResponsableId] = useState<string | null>(null)
  const [lineas, setLineas] = useState<LineaGrilla[]>([])
  const [linea, setLinea] = useState<LineaForm>(LINEA_VACIA)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null)
  const [lineaErrors, setLineaErrors] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  // Adjuntos pendientes (contrato nuevo): se suben al crear.
  const [pendientes, setPendientes] = useState<File[]>([])
  const [deleteAdjunto, setDeleteAdjunto] = useState<ContratoAdjunto | undefined>()
  const inputRef = useRef<HTMLInputElement>(null)
  const hidratado = useRef(false)

  // Hidratación al editar (una vez, cuando llega el contrato).
  useEffect(() => {
    if (!item || hidratado.current) return
    hidratado.current = true
    setEspecieId(item.especieId)
    setFechaInicio(item.fechaInicio.slice(0, 10))
    setFechaTermino(item.fechaTermino.slice(0, 10))
    setFechasTocadas(true)
    setResponsableId(item.responsableId)
    setLineas(item.lineas.map((l) => ({
      articuloId: l.articuloId,
      variedadId: l.variedadId,
      categoriaId: l.categoriaId,
      calibreDesdeId: l.calibreDesdeId,
      calibreHastaId: l.calibreHastaId,
      unidadMedidaId: l.unidadMedidaId,
      condicionPagoId: l.condicionPagoId,
      cantidadComprometida: Number(l.cantidadComprometida),
      minimoGarantizado: Number(l.minimoGarantizado),
    })))
  }, [item])

  // ─── Opciones ──────────────────────────────────────────────────────────────
  const { data: temporadasData } = useQuery({
    queryKey: ['temporadas-options-contrato'],
    queryFn: () => temporadasService.list({ limit: 500 }) as unknown as Promise<{ data: TemporadaOption[] }>,
    staleTime: 60_000,
    enabled: !isEdit,
  })
  const { data: especiesData } = useQuery({ queryKey: ['especies-options-contrato'], queryFn: () => especiesService.list({ limit: 200 }), staleTime: 5 * 60_000 })
  const { data: articulosData } = useQuery({
    queryKey: ['articulos-embalaje-options-contrato'],
    queryFn: () => articulosService.list({ limit: 500, tipo: 'EMBALAJE', activo: true }),
    staleTime: 60_000,
  })
  const { data: unidadesMedidaData } = useQuery({ queryKey: ['unidades-medida-options-contrato'], queryFn: () => unidadesMedidaService.list({ limit: 200 }), staleTime: 5 * 60_000 })
  // Condición de Pago tipo COMPRA (compromiso de compra al productor).
  const { data: condicionesPagoData } = useQuery({ queryKey: ['condiciones-pago-options', 'COMPRA'], queryFn: () => condicionesPagoService.list({ tipo: 'COMPRA' }), staleTime: 60_000 })
  const { data: responsablesData } = useQuery({
    queryKey: ['usuarios-responsables-venta-options'],
    queryFn: () => usuariosService.list({ limit: 500, esResponsableVenta: true }),
    staleTime: 60_000,
  })
  const { data: variedadesData } = useQuery({ queryKey: ['variedades-options-contrato', especieId], queryFn: () => variedadesService.list({ limit: 200, especieId: especieId! }), staleTime: 60_000, enabled: !!especieId })
  const { data: categoriasData } = useQuery({ queryKey: ['categorias-options-contrato', especieId], queryFn: () => categoriasService.list({ limit: 200, especieId: especieId! }), staleTime: 60_000, enabled: !!especieId })
  const { data: calibresData } = useQuery({ queryKey: ['calibres-options-contrato', especieId], queryFn: () => calibresService.list({ limit: 200, especieId: especieId! }), staleTime: 60_000, enabled: !!especieId })

  const especies = (especiesData?.data ?? []) as Ref[]
  const articulos = (articulosData?.data ?? []) as (Ref & { descripcionComercial?: string | null; etiqueta?: { descripcion: string } | null; kgNetoEnvase?: string | null; kgBrutoEnvase?: string | null })[]
  const unidadesMedida = (unidadesMedidaData?.data ?? []) as Ref[]
  const condicionesPago = (condicionesPagoData?.data ?? []) as Ref[]
  const responsables = responsablesData?.data ?? []
  const variedades = (variedadesData?.data ?? []) as Ref[]
  const categorias = (categoriasData?.data ?? []) as Ref[]
  const calibres = (calibresData?.data ?? []) as Ref[]

  // Nombre para la grilla: primero las opciones cargadas, luego las referencias
  // del contrato (por si el maestro quedó bloqueado y ya no está en la lista).
  const refsContrato = (campo: 'variedad' | 'categoria' | 'calibreDesde' | 'calibreHasta' | 'unidadMedida' | 'condicionPago' | 'articulo', id: number | null) =>
    id == null ? undefined : (item?.lineas.map((l) => l[campo]).find((r) => r?.id === id) as Ref | null | undefined) ?? undefined
  const nombre = (lista: Ref[], campo: Parameters<typeof refsContrato>[0], id: number | null) =>
    id == null ? '—' : lista.find((x) => x.id === id)?.descripcion ?? refsContrato(campo, id)?.descripcion ?? String(id)

  // Al crear, las fechas parten con el rango de la temporada activa mientras el
  // usuario no las modifique.
  const temporadaRango = !isEdit ? (temporadasData?.data ?? []).find((t) => t.id === temporadaId) : undefined
  if (!isEdit && !fechasTocadas && temporadaRango && (fechaInicio === '' || fechaTermino === '')) {
    setFechaInicio(temporadaRango.fechaInicio.slice(0, 10))
    setFechaTermino(temporadaRango.fechaTermino.slice(0, 10))
  }

  // ─── Líneas ────────────────────────────────────────────────────────────────
  function cambiarEspecie(id: number) {
    if (id === especieId) return
    setEspecieId(id)
    // Variedad/Categoría/Calibre dependen de la especie: las líneas no sirven.
    if (lineas.length > 0) toast.info('Cambió la especie: se quitaron las líneas del detalle')
    setLineas([])
    setLinea(LINEA_VACIA)
    setEditingIndex(null)
    setLineaErrors({})
  }

  function validarLinea(): LineaGrilla | null {
    const e: Record<string, string> = {}
    if (!linea.articuloId) e.articuloId = 'Requerido'
    if (!linea.variedadId) e.variedadId = 'Requerido'
    if (!linea.categoriaId) e.categoriaId = 'Requerido'
    if (!linea.calibreDesdeId) e.calibreDesdeId = 'Requerido'
    if (!linea.calibreHastaId) e.calibreHastaId = 'Requerido'
    if (!linea.unidadMedidaId) e.unidadMedidaId = 'Requerido'
    if (!linea.condicionPagoId) e.condicionPagoId = 'Requerido'
    const cant = Number(linea.cantidadComprometida)
    if (!linea.cantidadComprometida || !Number.isFinite(cant) || cant <= 0) e.cantidadComprometida = 'Debe ser mayor a 0'
    const min = linea.minimoGarantizado === '' ? 0 : Number(linea.minimoGarantizado)
    if (!Number.isFinite(min) || min < 0) e.minimoGarantizado = 'No puede ser negativo'
    setLineaErrors(e)
    if (Object.keys(e).length > 0) return null
    return {
      articuloId: linea.articuloId!,
      variedadId: linea.variedadId!,
      categoriaId: linea.categoriaId!,
      calibreDesdeId: linea.calibreDesdeId!,
      calibreHastaId: linea.calibreHastaId!,
      unidadMedidaId: linea.unidadMedidaId!,
      condicionPagoId: linea.condicionPagoId!,
      cantidadComprometida: cant,
      minimoGarantizado: min,
    }
  }

  function handleGuardarLinea() {
    const l = validarLinea()
    if (!l) return
    if (editingIndex != null) {
      setLineas((prev) => prev.map((x, i) => (i === editingIndex ? l : x)))
    } else {
      setLineas((prev) => [...prev, l])
    }
    setEditingIndex(null)
    setLinea(LINEA_VACIA)
    setErrors((prev) => ({ ...prev, lineas: '' }))
  }

  function handleEditarLinea(i: number) {
    setEditingIndex(i)
    setLinea(aForm(lineas[i]))
    setLineaErrors({})
  }

  // Duplicar: precarga el formulario de línea como una línea NUEVA.
  function handleDuplicarLinea(i: number) {
    setEditingIndex(null)
    setLinea(aForm(lineas[i]))
    setLineaErrors({})
    toast.info('Línea duplicada — ajusta lo que necesites y agrégala')
  }

  function handleCancelarLinea() {
    setEditingIndex(null)
    setLinea(LINEA_VACIA)
    setLineaErrors({})
  }

  function confirmarEliminarLinea() {
    if (deleteIndex == null) return
    setLineas((prev) => prev.filter((_, i) => i !== deleteIndex))
    if (editingIndex === deleteIndex) handleCancelarLinea()
    else if (editingIndex != null && editingIndex > deleteIndex) setEditingIndex(editingIndex - 1)
    setDeleteIndex(null)
  }

  // ─── Guardar ───────────────────────────────────────────────────────────────
  function validar(): boolean {
    const e: Record<string, string> = {}
    if (!temporadaId) e.temporadaId = 'No hay temporada activa: selecciónala en el selector general'
    if (!especieId) e.especieId = 'La especie es requerida'
    if (!fechaInicio) e.fechaInicio = 'La fecha de inicio es requerida'
    if (!fechaTermino) e.fechaTermino = 'La fecha de término es requerida'
    if (fechaInicio && fechaTermino && fechaInicio > fechaTermino) e.fechaTermino = 'La fecha de término no puede ser anterior al inicio'
    if (lineas.length === 0) e.lineas = 'Debe agregar al menos una línea al detalle'
    const sinCondicion = lineas.map((l, i) => (l.condicionPagoId ? null : i + 1)).filter((x) => x != null)
    if (sinCondicion.length > 0) e.lineas = `Falta la condición de pago en la(s) línea(s) ${sinCondicion.join(', ')}: edítalas antes de guardar`
    if (editingIndex != null) e.lineas = 'Termina de editar la línea (Actualizar o Cancelar) antes de guardar'
    setErrors(e)
    return Object.values(e).every((v) => !v)
  }

  const invalidar = () => {
    queryClient.invalidateQueries({ queryKey: ['productores', 'ficha', entidadId] })
    queryClient.invalidateQueries({ queryKey: ['productores', 'contrato', entidadId] })
  }

  const guardar = useMutation({
    mutationFn: async () => {
      // La temporada no viaja (2026-11-16): la fija el selector superior.
      const payload = {
        especieId: especieId!,
        fechaInicio,
        fechaTermino,
        responsableId,
        lineas: lineas as ContratoLineaInput[],
      }
      if (isEdit) {
        await contratosService.update(entidadId, contratoId!, payload)
        return { fallidos: [] as string[] }
      }
      const creado = await contratosService.create(entidadId, payload)
      // Adjuntos elegidos antes de guardar: se suben al contrato recién creado.
      const fallidos: string[] = []
      for (const archivo of pendientes) {
        try {
          await contratosService.agregarAdjunto(entidadId, creado.data.id, archivo)
        } catch {
          fallidos.push(archivo.name)
        }
      }
      return { fallidos }
    },
    onSuccess: ({ fallidos }) => {
      invalidar()
      if (fallidos.length > 0) {
        toast.warning(`Contrato creado, pero no se pudieron adjuntar: ${fallidos.join(', ')}. Adjúntalos al editar el contrato.`)
      } else {
        toast.success(isEdit ? 'Contrato actualizado' : 'Contrato creado')
      }
      router.push(volver)
    },
    onError: (e: Error) => toast.error(e.message || 'Error al guardar el contrato'),
  })

  function handleSubmit() {
    if (!validar()) {
      toast.error('Hay campos por corregir')
      return
    }
    guardar.mutate()
  }

  // ─── Adjuntos ──────────────────────────────────────────────────────────────
  const subirAdjunto = useMutation({
    mutationFn: (archivo: File) => contratosService.agregarAdjunto(entidadId, contratoId!, archivo),
    onSuccess: () => {
      invalidar()
      toast.success('Documento adjuntado')
    },
    onError: (e: Error) => toast.error(e.message || 'Error al adjuntar el documento'),
  })
  const eliminarAdjunto = useMutation({
    mutationFn: (adjuntoId: number) => contratosService.eliminarAdjunto(entidadId, contratoId!, adjuntoId),
    onSuccess: () => {
      invalidar()
      toast.success('Documento eliminado')
      setDeleteAdjunto(undefined)
    },
    onError: (e: Error) => toast.error(e.message || 'Error al eliminar el documento'),
  })

  function onArchivos(files: FileList | null) {
    const lista = Array.from(files ?? [])
    const grandes = lista.filter((f) => f.size > MAX_ADJUNTO_BYTES)
    if (grandes.length > 0) toast.error(`Supera 15 MB: ${grandes.map((f) => f.name).join(', ')}`)
    const validos = lista.filter((f) => f.size <= MAX_ADJUNTO_BYTES)
    if (isEdit) validos.forEach((f) => subirAdjunto.mutate(f))
    else setPendientes((prev) => [...prev, ...validos])
  }

  if (isEdit && contratoCargando) return <p className='text-sm text-muted-foreground'>Cargando contrato...</p>
  if (isEdit && !item) return <p className='text-sm text-destructive'>No se encontró el contrato.</p>

  const soloLectura = !puedeEscribir
  const articuloSel = articulos.find((a) => a.id === linea.articuloId)
  const err = (k: string) => (lineaErrors[k] ? <p className='text-xs text-destructive'>{lineaErrors[k]}</p> : null)

  return (
    <div className='space-y-4'>
      <fieldset disabled={soloLectura} className='space-y-4'>
        {/* ─── Datos generales ─── */}
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>Datos generales</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='grid gap-4 md:grid-cols-5'>
              <div className='space-y-1.5'>
                <Label>Temporada</Label>
                <p className='flex h-9 items-center text-sm text-muted-foreground'>
                  {temporadaCodigo ?? '—'}{!isEdit && ' (activa)'}
                </p>
                {errors.temporadaId && <p className='text-xs text-destructive'>{errors.temporadaId}</p>}
              </div>
              <div className='space-y-1.5'>
                <Label>Especie <span className='text-destructive'>*</span></Label>
                <Select value={especieId ? String(especieId) : ''} onValueChange={(v) => cambiarEspecie(Number(v))}>
                  <SelectTrigger><SelectValue placeholder='Seleccionar...' /></SelectTrigger>
                  <SelectContent>
                    {especies.map((e) => <SelectItem key={e.id} value={String(e.id)}>{e.descripcion}</SelectItem>)}
                  </SelectContent>
                </Select>
                {errors.especieId && <p className='text-xs text-destructive'>{errors.especieId}</p>}
              </div>
              <div className='space-y-1.5'>
                <Label>Fecha inicio <span className='text-destructive'>*</span></Label>
                <Input type='date' value={fechaInicio} onChange={(e) => { setFechaInicio(e.target.value); setFechasTocadas(true) }} />
                {errors.fechaInicio && <p className='text-xs text-destructive'>{errors.fechaInicio}</p>}
              </div>
              <div className='space-y-1.5'>
                <Label>Fecha término <span className='text-destructive'>*</span></Label>
                <Input type='date' value={fechaTermino} onChange={(e) => { setFechaTermino(e.target.value); setFechasTocadas(true) }} />
                {errors.fechaTermino && <p className='text-xs text-destructive'>{errors.fechaTermino}</p>}
              </div>
              <div className='space-y-1.5'>
                <Label>Responsable</Label>
                <Select value={responsableId ?? '__none__'} onValueChange={(v) => setResponsableId(v === '__none__' ? null : v)}>
                  <SelectTrigger><SelectValue placeholder='Sin definir' /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value='__none__'>Sin definir</SelectItem>
                    {responsables.map((u) => <SelectItem key={u.id} value={u.id}>{u.nombre}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ─── Detalle ─── */}
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>Detalle</CardTitle>
          </CardHeader>
          <CardContent className='space-y-4'>
            {!soloLectura && (
              <div className='space-y-3 rounded-md border p-3'>
                <p className='text-sm font-medium'>{editingIndex != null ? `Editando línea ${editingIndex + 1}` : 'Agregar línea'}</p>
                {!especieId && <p className='text-xs text-muted-foreground'>Selecciona la especie para agregar líneas.</p>}
                <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
                  <div className='space-y-1.5 lg:col-span-2'>
                    <Label className='text-xs'>Embalaje <span className='text-destructive'>*</span></Label>
                    <Combobox
                      options={articulos.map((a) => ({ value: String(a.id), label: `${a.codigo} · ${articuloDescripcionComercial(a)}` }))}
                      value={linea.articuloId ? String(linea.articuloId) : null}
                      onChange={(v) => setLinea((p) => ({ ...p, articuloId: v ? Number(v) : null }))}
                      placeholder='Seleccionar...'
                      searchPlaceholder='Buscar embalaje...'
                      disabled={!especieId}
                    />
                    {err('articuloId')}
                  </div>
                  <div className='space-y-1.5'>
                    <Label className='text-xs'>Variedad <span className='text-destructive'>*</span></Label>
                    <Select value={linea.variedadId ? String(linea.variedadId) : ''} onValueChange={(v) => setLinea((p) => ({ ...p, variedadId: Number(v) }))} disabled={!especieId}>
                      <SelectTrigger><SelectValue placeholder='Seleccionar...' /></SelectTrigger>
                      <SelectContent>{variedades.map((v) => <SelectItem key={v.id} value={String(v.id)}>{v.descripcion}</SelectItem>)}</SelectContent>
                    </Select>
                    {err('variedadId')}
                  </div>
                  <div className='space-y-1.5'>
                    <Label className='text-xs'>Categoría <span className='text-destructive'>*</span></Label>
                    <Select value={linea.categoriaId ? String(linea.categoriaId) : ''} onValueChange={(v) => setLinea((p) => ({ ...p, categoriaId: Number(v) }))} disabled={!especieId}>
                      <SelectTrigger><SelectValue placeholder='Seleccionar...' /></SelectTrigger>
                      <SelectContent>{categorias.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.descripcion}</SelectItem>)}</SelectContent>
                    </Select>
                    {err('categoriaId')}
                  </div>
                  <div className='space-y-1.5'>
                    <Label className='text-xs'>Calibre desde <span className='text-destructive'>*</span></Label>
                    <Select value={linea.calibreDesdeId ? String(linea.calibreDesdeId) : ''} onValueChange={(v) => setLinea((p) => ({ ...p, calibreDesdeId: Number(v) }))} disabled={!especieId}>
                      <SelectTrigger><SelectValue placeholder='Seleccionar...' /></SelectTrigger>
                      <SelectContent>{calibres.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.descripcion}</SelectItem>)}</SelectContent>
                    </Select>
                    {err('calibreDesdeId')}
                  </div>
                  <div className='space-y-1.5'>
                    <Label className='text-xs'>Calibre hasta <span className='text-destructive'>*</span></Label>
                    <Select value={linea.calibreHastaId ? String(linea.calibreHastaId) : ''} onValueChange={(v) => setLinea((p) => ({ ...p, calibreHastaId: Number(v) }))} disabled={!especieId}>
                      <SelectTrigger><SelectValue placeholder='Seleccionar...' /></SelectTrigger>
                      <SelectContent>{calibres.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.descripcion}</SelectItem>)}</SelectContent>
                    </Select>
                    {err('calibreHastaId')}
                  </div>
                  <div className='space-y-1.5'>
                    <Label className='text-xs'>Unidad de medida <span className='text-destructive'>*</span></Label>
                    <Select value={linea.unidadMedidaId ? String(linea.unidadMedidaId) : ''} onValueChange={(v) => setLinea((p) => ({ ...p, unidadMedidaId: Number(v) }))} disabled={!especieId}>
                      <SelectTrigger><SelectValue placeholder='Seleccionar...' /></SelectTrigger>
                      <SelectContent>{unidadesMedida.map((u) => <SelectItem key={u.id} value={String(u.id)}>{u.descripcion}</SelectItem>)}</SelectContent>
                    </Select>
                    {err('unidadMedidaId')}
                  </div>
                  <div className='space-y-1.5'>
                    <Label className='text-xs'>Condición de pago <span className='text-destructive'>*</span></Label>
                    <Select value={linea.condicionPagoId ? String(linea.condicionPagoId) : ''} onValueChange={(v) => setLinea((p) => ({ ...p, condicionPagoId: Number(v) }))} disabled={!especieId}>
                      <SelectTrigger><SelectValue placeholder='Seleccionar...' /></SelectTrigger>
                      <SelectContent>{condicionesPago.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.descripcion}</SelectItem>)}</SelectContent>
                    </Select>
                    {err('condicionPagoId')}
                  </div>
                  <div className='space-y-1.5'>
                    <Label className='text-xs'>Cantidad comprometida <span className='text-destructive'>*</span></Label>
                    <Input type='number' step='0.001' min='0' value={linea.cantidadComprometida} onChange={(e) => setLinea((p) => ({ ...p, cantidadComprometida: e.target.value }))} disabled={!especieId} />
                    {err('cantidadComprometida')}
                  </div>
                  <div className='space-y-1.5'>
                    <Label className='text-xs'>Mínimo garantizado</Label>
                    <Input type='number' step='0.0001' min='0' value={linea.minimoGarantizado} onChange={(e) => setLinea((p) => ({ ...p, minimoGarantizado: e.target.value }))} disabled={!especieId} />
                    {err('minimoGarantizado')}
                  </div>
                </div>
                {articuloSel && (articuloSel.etiqueta || articuloSel.kgNetoEnvase) && (
                  <p className='text-xs text-muted-foreground'>
                    Etiqueta: {articuloSel.etiqueta?.descripcion ?? '—'} · Kg Neto: {articuloSel.kgNetoEnvase ?? '—'} · Kg Bruto: {articuloSel.kgBrutoEnvase ?? '—'}
                  </p>
                )}
                <div className='flex gap-2'>
                  <Button type='button' size='sm' onClick={handleGuardarLinea} disabled={!especieId}>
                    <Icons.add className='mr-1 h-4 w-4' /> {editingIndex != null ? 'Actualizar línea' : 'Agregar línea'}
                  </Button>
                  {(editingIndex != null || linea !== LINEA_VACIA) && (
                    <Button type='button' size='sm' variant='outline' onClick={handleCancelarLinea}>Cancelar</Button>
                  )}
                </div>
              </div>
            )}

            {errors.lineas && <p className='text-sm text-destructive'>{errors.lineas}</p>}

            {lineas.length === 0 ? (
              <p className='text-sm text-muted-foreground'>Sin líneas en el detalle.</p>
            ) : (
              <div className='overflow-x-auto rounded-md border'>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className='w-10'>#</TableHead>
                      <TableHead>Embalaje</TableHead>
                      <TableHead>Variedad</TableHead>
                      <TableHead>Categoría</TableHead>
                      <TableHead>Calibre</TableHead>
                      <TableHead>Condición de pago</TableHead>
                      <TableHead className='text-right'>Comprometido</TableHead>
                      <TableHead className='text-right'>Mín. garantizado</TableHead>
                      {!soloLectura && <TableHead className='w-28 text-right'>Acciones</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lineas.map((l, i) => {
                      const art = articulos.find((a) => a.id === l.articuloId) ?? refsContrato('articulo', l.articuloId)
                      const unidad = unidadesMedida.find((u) => u.id === l.unidadMedidaId) ?? refsContrato('unidadMedida', l.unidadMedidaId)
                      return (
                        <TableRow key={i} className={editingIndex === i ? 'bg-muted/60' : undefined}>
                          <TableCell className='text-muted-foreground'>{i + 1}</TableCell>
                          <TableCell className='whitespace-nowrap'>
                            <div className='font-medium'>{art?.codigo ?? String(l.articuloId)}</div>
                            {art && <div className='text-xs text-muted-foreground'>{articuloDescripcionComercial(art)}</div>}
                          </TableCell>
                          <TableCell className='whitespace-nowrap'>{nombre(variedades, 'variedad', l.variedadId)}</TableCell>
                          <TableCell className='whitespace-nowrap'>{nombre(categorias, 'categoria', l.categoriaId)}</TableCell>
                          <TableCell className='whitespace-nowrap'>
                            {nombre(calibres, 'calibreDesde', l.calibreDesdeId)}–{nombre(calibres, 'calibreHasta', l.calibreHastaId)}
                          </TableCell>
                          <TableCell className='whitespace-nowrap'>
                            {l.condicionPagoId ? nombre(condicionesPago, 'condicionPago', l.condicionPagoId) : <Badge variant='destructive'>Falta</Badge>}
                          </TableCell>
                          <TableCell className='whitespace-nowrap text-right tabular-nums'>{fmtNum.format(l.cantidadComprometida)} {unidad?.codigo ?? ''}</TableCell>
                          <TableCell className='whitespace-nowrap text-right tabular-nums'>{fmtNum.format(l.minimoGarantizado)}</TableCell>
                          {!soloLectura && (
                            <TableCell className='text-right'>
                              <div className='flex justify-end gap-1'>
                                <Button type='button' variant='ghost' size='icon' className='h-8 w-8' title='Editar' onClick={() => handleEditarLinea(i)}>
                                  <Icons.edit className='h-4 w-4' />
                                </Button>
                                <Button type='button' variant='ghost' size='icon' className='h-8 w-8' title='Duplicar' onClick={() => handleDuplicarLinea(i)}>
                                  <Icons.copy className='h-4 w-4' />
                                </Button>
                                <Button type='button' variant='ghost' size='icon' className='h-8 w-8' title='Eliminar' onClick={() => setDeleteIndex(i)}>
                                  <Icons.trash className='h-4 w-4' />
                                </Button>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </fieldset>

      {/* ─── Documentos adjuntos (binario en BD) ─── */}
      <Card>
        <CardHeader className='flex flex-row items-center justify-between space-y-0'>
          <CardTitle className='text-base'>Documentos adjuntos</CardTitle>
          {!soloLectura && (
            <>
              <input
                ref={inputRef}
                type='file'
                multiple
                className='hidden'
                onChange={(e) => { onArchivos(e.target.files); e.target.value = '' }}
              />
              <Button type='button' variant='outline' size='sm' onClick={() => inputRef.current?.click()} isLoading={subirAdjunto.isPending}>
                <Icons.upload className='mr-1 h-4 w-4' /> Adjuntar documentos
              </Button>
            </>
          )}
        </CardHeader>
        <CardContent className='space-y-2'>
          {!isEdit && pendientes.length > 0 && (
            <p className='text-xs text-muted-foreground'>Se adjuntarán al crear el contrato.</p>
          )}
          {(isEdit ? item?.adjuntos.length ?? 0 : pendientes.length) === 0 ? (
            <p className='text-sm text-muted-foreground'>Sin documentos adjuntos (máx. 15 MB por archivo).</p>
          ) : (
            <ul className='divide-y rounded-md border'>
              {isEdit
                ? item!.adjuntos.map((a) => (
                    <li key={a.id} className='flex items-center justify-between gap-2 px-3 py-2 text-sm'>
                      <a
                        href={contratosService.urlDescargaAdjunto(entidadId, item!.id, a.id)}
                        target='_blank'
                        rel='noopener noreferrer'
                        className='inline-flex items-center gap-1 text-primary hover:underline'
                      >
                        <Icons.paperclip className='h-4 w-4' /> {a.nombre}
                      </a>
                      <div className='flex items-center gap-2'>
                        <span className='text-xs text-muted-foreground'>{formatBytes(a.tamano)}</span>
                        {!soloLectura && (
                          <Button type='button' variant='ghost' size='icon' className='h-7 w-7' title='Eliminar' onClick={() => setDeleteAdjunto(a)}>
                            <Icons.trash className='h-3.5 w-3.5' />
                          </Button>
                        )}
                      </div>
                    </li>
                  ))
                : pendientes.map((f, i) => (
                    <li key={`${f.name}-${i}`} className='flex items-center justify-between gap-2 px-3 py-2 text-sm'>
                      <span className='inline-flex items-center gap-1'><Icons.paperclip className='h-4 w-4' /> {f.name}</span>
                      <div className='flex items-center gap-2'>
                        <span className='text-xs text-muted-foreground'>{formatBytes(f.size)}</span>
                        <Button type='button' variant='ghost' size='icon' className='h-7 w-7' title='Quitar' onClick={() => setPendientes((p) => p.filter((_, j) => j !== i))}>
                          <Icons.trash className='h-3.5 w-3.5' />
                        </Button>
                      </div>
                    </li>
                  ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <AvisoSinTemporada mostrar={sinTemporada && !temporadaCargando} />

      <div className='flex justify-end gap-2'>
        <Button variant='outline' asChild>
          <Link href={volver}>{soloLectura ? 'Volver' : 'Cancelar'}</Link>
        </Button>
        {!soloLectura && (
          <Button onClick={handleSubmit} isLoading={guardar.isPending} disabled={sinTemporada}>
            <Icons.check className='mr-1 h-4 w-4' /> {isEdit ? 'Guardar cambios' : 'Crear contrato'}
          </Button>
        )}
      </div>

      <AlertModal
        isOpen={deleteIndex != null}
        onClose={() => setDeleteIndex(null)}
        onConfirm={confirmarEliminarLinea}
        loading={false}
        title='Eliminar línea'
        description={deleteIndex != null ? `¿Eliminar la línea ${deleteIndex + 1} del detalle?` : ''}
      />
      <AlertModal
        isOpen={!!deleteAdjunto}
        onClose={() => setDeleteAdjunto(undefined)}
        onConfirm={() => deleteAdjunto && eliminarAdjunto.mutate(deleteAdjunto.id)}
        loading={eliminarAdjunto.isPending}
        title='Eliminar documento'
        description={`¿Eliminar el documento "${deleteAdjunto?.nombre}"?`}
      />
    </div>
  )
}
