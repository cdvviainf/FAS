'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
import { usePuedeEscribir } from '@/hooks/use-item-acceso'
import { createMantenedorService } from '@/features/mantenedor-simple/service'
import { articulosService } from '@/features/materiales/articulos/service'
import { notasVentaService } from '@/features/ventas/notas-venta/service'
import { instructivoEmbalajeDetailOptions, instructivosEmbalajeKeys } from '../queries'
import { instructivoEmbalajeService } from '../service'
import type { InstructivoEmbalajeDetalleInput } from '../types'

const ITEM = 'COMPRAS_INSTRUCTIVO'

const especiesService = createMantenedorService('especies')
const variedadesService = createMantenedorService('variedades')
const categoriasService = createMantenedorService('categorias')
const calibresService = createMantenedorService('calibres')
const tiposPalletService = createMantenedorService('tipos-pallet')

// Cajas por pallet aún no tiene mantenedor propio (pendiente de desarrollar).
// Mientras tanto se asume un valor fijo, usado para precalcular "Cantidad de
// Cajas" y que el usuario puede sobrescribir manualmente (mismo criterio que
// nota-venta-form.tsx / orden-compra-form.tsx).
const CAJAS_POR_PALLET_DEFAULT = 108

interface NuevaLinea {
  articuloId: number
  especieId: number
  variedadId: number
  categoriaId: number
  calibreIds: number[]
  tipoPalletId: number | null
  cantidadPallets: string
  cajasPorPallet: string
  cajas: string
}

const LINEA_EMPTY: NuevaLinea = {
  articuloId: 0,
  especieId: 0,
  variedadId: 0,
  categoriaId: 0,
  calibreIds: [],
  tipoPalletId: null,
  cantidadPallets: '',
  cajasPorPallet: String(CAJAS_POR_PALLET_DEFAULT),
  cajas: '',
}

interface InstructivoEmbalajeFormProps {
  instructivoId?: number
}

export function InstructivoEmbalajeForm({ instructivoId }: InstructivoEmbalajeFormProps) {
  const isEdit = !!instructivoId
  const router = useRouter()
  const queryClient = useQueryClient()
  const puedeEscribir = usePuedeEscribir(ITEM)

  const [notaVentaId, setNotaVentaId] = useState(0)
  const [detalle, setDetalle] = useState<InstructivoEmbalajeDetalleInput[]>([])
  const [linea, setLinea] = useState<NuevaLinea>(LINEA_EMPTY)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [lineaErrors, setLineaErrors] = useState<Record<string, string>>({})
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null)
  const [calibreDesdeId, setCalibreDesdeId] = useState<number | null>(null)
  const [calibreHastaId, setCalibreHastaId] = useState<number | null>(null)

  const { data: instructivo, isLoading: isLoadingInstructivo } = useQuery({
    ...instructivoEmbalajeDetailOptions(instructivoId ?? 0),
    enabled: isEdit,
  })

  const { data: notasVentaData } = useQuery({
    queryKey: ['notas-venta-options'],
    queryFn: () => notasVentaService.list({ limit: 200 }),
    staleTime: 60_000,
  })
  const { data: especiesData } = useQuery({ queryKey: ['especies-options'], queryFn: () => especiesService.list({ limit: 200 }), staleTime: 5 * 60_000 })
  const { data: variedadesData } = useQuery({ queryKey: ['variedades-options', linea.especieId], queryFn: () => variedadesService.list({ limit: 200, especieId: linea.especieId }), staleTime: 60_000, enabled: !!linea.especieId })
  const { data: categoriasData } = useQuery({ queryKey: ['categorias-options', linea.especieId], queryFn: () => categoriasService.list({ limit: 200, especieId: linea.especieId }), staleTime: 60_000, enabled: !!linea.especieId })
  const { data: calibresData } = useQuery({ queryKey: ['calibres-options', linea.especieId], queryFn: () => calibresService.list({ limit: 200, especieId: linea.especieId }), staleTime: 60_000, enabled: !!linea.especieId })
  const { data: articulosData } = useQuery({ queryKey: ['articulos-embalaje-options'], queryFn: () => articulosService.list({ limit: 500, tipo: 'EMBALAJE', activo: true }), staleTime: 60_000 })
  const { data: tiposPalletData } = useQuery({ queryKey: ['tipos-pallet-options'], queryFn: () => tiposPalletService.list({ limit: 200 }), staleTime: 5 * 60_000 })

  const especies = especiesData?.data ?? []
  const variedades = variedadesData?.data ?? []
  const categorias = categoriasData?.data ?? []
  const calibres = calibresData?.data ?? []
  const tiposPallet = tiposPalletData?.data ?? []

  // Con permiso TOTAL en COMPRAS_INSTRUCTIVO pero sin VENTAS_NV/OPER_MATERIALES,
  // esas dos consultas devuelven 403 y su lista queda vacía — el Select no
  // tiene con qué mostrar el nombre del valor ya guardado y se ve en blanco,
  // aunque el dato sigue correcto por dentro (IE-EDIT-QA-003, arbitrado
  // BUG_REAL). Se inyecta la referencia ya conocida por el propio GET del
  // instructivo para que su nombre siga visible; elegir una Nota de Venta o
  // Artículo nuevo que el usuario no puede listar sigue sin ser posible, por
  // diseño (no se puede elegir de un catálogo al que no se tiene acceso).
  const notaVentaOptions: { id: number; folio: number; cliente: { descripcion: string } }[] = (() => {
    const base = notasVentaData?.data ?? []
    if (isEdit && instructivo && !base.some((nv) => nv.id === instructivo.data.notaVenta.id)) {
      return [instructivo.data.notaVenta, ...base]
    }
    return base
  })()

  const articulos: { id: number; codigo: string; descripcion: string }[] = (() => {
    const base = articulosData?.data ?? []
    if (!isEdit || !instructivo) return base
    const faltantes = instructivo.data.detalle
      .map((d) => d.articulo)
      .filter((a) => !base.some((b) => b.id === a.id))
    const faltantesUnicos = Array.from(new Map(faltantes.map((a) => [a.id, a])).values())
    return faltantesUnicos.length ? [...faltantesUnicos, ...base] : base
  })()

  function nombre(lista: { id: number; codigo?: string; descripcion: string }[], id: number) {
    const item = lista.find((i) => i.id === id)
    return item ? (item.codigo ? `${item.codigo} — ${item.descripcion}` : item.descripcion) : String(id)
  }

  useEffect(() => {
    if (instructivo) {
      const d = instructivo.data
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hidratación desde la consulta al entrar en modo edición, no un derivado de props/estado local.
      setNotaVentaId(d.notaVentaId)
      setDetalle(
        d.detalle.map((linea) => ({
          articuloId: linea.articuloId,
          especieId: linea.especieId,
          variedadId: linea.variedadId,
          categoriaId: linea.categoriaId,
          calibreIds: linea.calibres.map((c) => c.calibre.id),
          tipoPalletId: linea.tipoPalletId,
          cantidadPallets: linea.cantidadPallets,
          cajasPorPallet: linea.cajasPorPallet,
          cajas: linea.cajas,
        })),
      )
    }
  }, [instructivo])

  function validarLinea(): boolean {
    const e: Record<string, string> = {}
    if (!linea.articuloId) e.articuloId = 'Requerido'
    if (!linea.especieId) e.especieId = 'Requerida'
    if (!linea.variedadId) e.variedadId = 'Requerida'
    if (!linea.categoriaId) e.categoriaId = 'Requerida'
    if (linea.calibreIds.length === 0) e.calibreIds = 'Selecciona al menos un calibre'
    if (!linea.cantidadPallets || Number(linea.cantidadPallets) <= 0) e.cantidadPallets = 'Debe ser mayor a 0'
    if (!linea.cajas || Number(linea.cajas) <= 0) e.cajas = 'Debe ser mayor a 0'
    setLineaErrors(e)
    return Object.keys(e).length === 0
  }

  function handleGuardarLinea() {
    if (!validarLinea()) return
    const nueva: InstructivoEmbalajeDetalleInput = {
      articuloId: linea.articuloId,
      especieId: linea.especieId,
      variedadId: linea.variedadId,
      categoriaId: linea.categoriaId,
      calibreIds: linea.calibreIds,
      tipoPalletId: linea.tipoPalletId,
      cantidadPallets: Number(linea.cantidadPallets),
      cajasPorPallet: Number(linea.cajasPorPallet),
      cajas: Number(linea.cajas),
    }
    if (editingIndex != null) {
      setDetalle((prev) => prev.map((d, i) => (i === editingIndex ? nueva : d)))
      setEditingIndex(null)
    } else {
      setDetalle((prev) => [...prev, nueva])
    }
    setLinea(LINEA_EMPTY)
    setLineaErrors({})
    resetCalibreRango()
  }

  function handleEditarLinea(index: number) {
    const d = detalle[index]
    setEditingIndex(index)
    setLinea({
      articuloId: d.articuloId,
      especieId: d.especieId,
      variedadId: d.variedadId,
      categoriaId: d.categoriaId,
      calibreIds: d.calibreIds,
      tipoPalletId: d.tipoPalletId,
      cantidadPallets: String(d.cantidadPallets),
      cajasPorPallet: String(d.cajasPorPallet),
      cajas: String(d.cajas),
    })
    setLineaErrors({})
    resetCalibreRango()
  }

  function handleCancelarEdicionLinea() {
    setEditingIndex(null)
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
    const lista = calibres
    const hastaId = calibreHastaId ?? calibreDesdeId
    const idxDesde = lista.findIndex((c) => c.id === calibreDesdeId)
    const idxHasta = lista.findIndex((c) => c.id === hastaId)
    if (idxDesde === -1 || idxHasta === -1) return
    const [ini, fin] = idxDesde <= idxHasta ? [idxDesde, idxHasta] : [idxHasta, idxDesde]
    const nuevos = lista.slice(ini, fin + 1).map((c) => c.id)
    setLinea((l) => ({ ...l, calibreIds: Array.from(new Set([...l.calibreIds, ...nuevos])) }))
    resetCalibreRango()
  }

  function confirmarEliminarLinea() {
    if (deleteIndex == null) return
    setDetalle((prev) => prev.filter((_, i) => i !== deleteIndex))
    if (editingIndex === deleteIndex) handleCancelarEdicionLinea()
    setDeleteIndex(null)
  }

  const createMutation = useMutation({
    mutationFn: () => instructivoEmbalajeService.create({ notaVentaId, detalle }),
    onSuccess: (res) => {
      toast.success(`Instructivo de Embalaje N° ${res.data.numero} creado`)
      queryClient.invalidateQueries({ queryKey: instructivosEmbalajeKeys.all })
      router.push(`/dashboard/compras/instructivo-embalaje/${res.data.id}`)
    },
    onError: (e: Error) => toast.error(e.message || 'Error al crear el Instructivo de Embalaje'),
  })

  const updateMutation = useMutation({
    mutationFn: () => instructivoEmbalajeService.update(instructivoId!, { notaVentaId, detalle }),
    onSuccess: () => {
      toast.success('Instructivo de Embalaje actualizado')
      queryClient.invalidateQueries({ queryKey: instructivosEmbalajeKeys.all })
      queryClient.invalidateQueries({ queryKey: instructivosEmbalajeKeys.detail(instructivoId!) })
    },
    onError: (e: Error) => toast.error(e.message || 'Error al actualizar el Instructivo de Embalaje'),
  })

  function validar(): boolean {
    const e: Record<string, string> = {}
    if (!notaVentaId) e.notaVentaId = 'El Cierre Comercial es requerido'
    if (detalle.length === 0) e.detalle = 'Debe agregar al menos una línea'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit() {
    if (!validar()) return
    if (isEdit) {
      updateMutation.mutate()
    } else {
      createMutation.mutate()
    }
  }

  const soloLectura = !puedeEscribir
  const isPending = createMutation.isPending || updateMutation.isPending

  if (isEdit && isLoadingInstructivo) {
    return <p className='text-sm text-muted-foreground'>Cargando…</p>
  }

  // Sin permiso TOTAL: se muestra un resumen a partir de los datos anidados
  // que ya trae el propio GET, sin depender de las listas auxiliares (Cierre
  // Comercial, Artículos, mantenedores) — un usuario con solo LECTURA en
  // COMPRAS_INSTRUCTIVO puede no tener acceso a esos otros ítems y vería IDs
  // en vez de nombres si reusara el formulario interactivo (IE-EDIT-QA-003).
  if (isEdit && soloLectura && instructivo) {
    const d = instructivo.data
    return (
      <div className='space-y-6'>
        <Badge variant='secondary'>Solo lectura — sin permiso de edición</Badge>
        <Card>
          <CardHeader>
            <CardTitle>Instructivo de Embalaje N° {d.numero}</CardTitle>
          </CardHeader>
          <CardContent className='space-y-2 text-sm'>
            <p><span className='text-muted-foreground'>Cierre Comercial:</span> Folio {d.notaVenta.folio} — {d.notaVenta.cliente.descripcion}</p>
            <p><span className='text-muted-foreground'>Emitido:</span> {new Date(d.creadoEn).toLocaleString('es-CL')}</p>
            <p><span className='text-muted-foreground'>Emitido por:</span> {d.creadoPor}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Detalle — qué embalar</CardTitle>
          </CardHeader>
          <CardContent className='space-y-2'>
            {d.detalle.map((linea) => (
              <div key={linea.id} className='flex flex-wrap items-center gap-2 border-b pb-2 text-sm last:border-b-0 last:pb-0'>
                <span className='font-medium'>{linea.especie.descripcion} / {linea.variedad.descripcion}</span>
                <span className='text-muted-foreground'>{linea.articulo.codigo} — {linea.articulo.descripcion}</span>
                <span className='text-muted-foreground'>· {linea.categoria.descripcion}</span>
                <span className='flex flex-wrap items-center gap-1 text-muted-foreground'>
                  · Calibres:
                  {linea.calibres.map((c) => (
                    <Badge key={c.calibre.id} variant='outline' className='text-xs'>{c.calibre.codigo}</Badge>
                  ))}
                </span>
                <span className='ml-auto text-muted-foreground'>{linea.cantidadPallets} pallets · {linea.cajas} cajas</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className='flex justify-end'>
          <Button variant='outline' onClick={() => router.push('/dashboard/compras/instructivo-embalaje')}>Volver</Button>
        </div>
      </div>
    )
  }

  return (
    <div className='space-y-6'>
      {soloLectura && <Badge variant='secondary'>Solo lectura — sin permiso de edición</Badge>}
      <fieldset disabled={soloLectura} className='m-0 space-y-6 border-0 p-0'>
      <Card>
        <CardHeader>
          <CardTitle>{isEdit ? `Editar Instructivo de Embalaje N° ${instructivo?.data.numero}` : 'Nuevo Instructivo de Embalaje'}</CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='space-y-1.5'>
            <Label>Cierre Comercial <span className='text-destructive'>*</span></Label>
            <Select value={notaVentaId ? String(notaVentaId) : ''} onValueChange={(v) => setNotaVentaId(Number(v))}>
              <SelectTrigger><SelectValue placeholder='Seleccionar Cierre Comercial...' /></SelectTrigger>
              <SelectContent>
                {notaVentaOptions.map((nv) => (
                  <SelectItem key={nv.id} value={String(nv.id)}>Folio {nv.folio} — {nv.cliente.descripcion}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.notaVentaId && <p className='text-xs text-destructive'>{errors.notaVentaId}</p>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Detalle — qué embalar</CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          {errors.detalle && <p className='text-xs text-destructive'>{errors.detalle}</p>}

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
              <Label>Artículo (Embalaje) <span className='text-destructive'>*</span></Label>
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
                  {variedades.map((v) => (
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
                  {categorias.map((c) => (
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
                  {calibres.map((c) => (
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
                  {calibres.map((c) => (
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
                  const opt = calibres.find((c) => c.id === id)
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
            <p className='text-xs text-muted-foreground'>El orden lo define el maestro de Calibres por especie.</p>
          </div>

          {/* Fila 4: Tipo Pallet, Cant. Pallets, Cantidad de Cajas */}
          <div className='grid gap-3 sm:grid-cols-2 md:grid-cols-3'>
            <div className='space-y-1.5'>
              <Label>Tipo Pallet</Label>
              <Select value={linea.tipoPalletId ? String(linea.tipoPalletId) : '__none__'} onValueChange={(v) => setLinea((l) => ({ ...l, tipoPalletId: v === '__none__' ? null : Number(v) }))}>
                <SelectTrigger><SelectValue placeholder='Sin definir' /></SelectTrigger>
                <SelectContent>
                  <SelectItem value='__none__'>Sin definir</SelectItem>
                  {tiposPallet.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>{t.descripcion}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className='space-y-1.5'>
              <Label>Cant. Pallets <span className='text-destructive'>*</span></Label>
              <Input
                type='number'
                value={linea.cantidadPallets}
                onChange={(e) => {
                  const v = e.target.value
                  setLinea((l) => ({ ...l, cantidadPallets: v, cajas: v ? String(Number(v) * CAJAS_POR_PALLET_DEFAULT) : l.cajas }))
                }}
              />
              {lineaErrors.cantidadPallets && <p className='text-xs text-destructive'>{lineaErrors.cantidadPallets}</p>}
            </div>
            <div className='space-y-1.5'>
              <Label>Cantidad de Cajas <span className='text-destructive'>*</span></Label>
              <Input type='number' value={linea.cajas} onChange={(e) => setLinea((l) => ({ ...l, cajas: e.target.value }))} />
              {lineaErrors.cajas && <p className='text-xs text-destructive'>{lineaErrors.cajas}</p>}
            </div>
          </div>

          <div className='flex justify-end gap-2'>
            {editingIndex != null && (
              <Button type='button' variant='outline' onClick={handleCancelarEdicionLinea}>
                Cancelar edición
              </Button>
            )}
            <Button type='button' variant='secondary' onClick={handleGuardarLinea}>
              {editingIndex != null ? <><Icons.check className='mr-1 h-4 w-4' /> Guardar cambios de línea</> : <><Icons.add className='mr-1 h-4 w-4' /> Agregar línea</>}
            </Button>
          </div>

          {detalle.length > 0 && (
            <div className='overflow-x-auto rounded-md border'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Especie / Variedad</TableHead>
                    <TableHead>Artículo</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Calibre</TableHead>
                    <TableHead>Cantidad</TableHead>
                    <TableHead className='w-20 text-right'>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detalle.map((d, i) => (
                    <TableRow key={i}>
                      <TableCell className='font-medium whitespace-nowrap'>{nombre(especies, d.especieId)} / {nombre(variedades, d.variedadId)}</TableCell>
                      <TableCell className='whitespace-nowrap text-muted-foreground'>{nombre(articulos, d.articuloId)}</TableCell>
                      <TableCell className='whitespace-nowrap text-muted-foreground'>{nombre(categorias, d.categoriaId)}</TableCell>
                      <TableCell className='max-w-[180px] text-muted-foreground'>
                        <div className='flex flex-wrap gap-1'>
                          {d.calibreIds.map((id) => (
                            <Badge key={id} variant='outline' className='text-xs'>{nombre(calibres, id)}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className='whitespace-nowrap text-muted-foreground'>{d.cantidadPallets} pallets · {d.cajas} cajas</TableCell>
                      <TableCell className='text-right'>
                        <div className='flex justify-end gap-1'>
                          <Button type='button' variant='ghost' size='icon' className='h-8 w-8' onClick={() => handleEditarLinea(i)}>
                            <Icons.edit className='h-4 w-4' />
                          </Button>
                          <Button type='button' variant='ghost' size='icon' className='h-8 w-8' onClick={() => setDeleteIndex(i)}>
                            <Icons.trash className='h-4 w-4' />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <AlertModal
            isOpen={deleteIndex != null}
            onClose={() => setDeleteIndex(null)}
            onConfirm={confirmarEliminarLinea}
            loading={false}
          />
        </CardContent>
      </Card>
      </fieldset>

      <div className='flex justify-end gap-2'>
        <Button variant='outline' onClick={() => router.push('/dashboard/compras/instructivo-embalaje')} disabled={isPending}>
          {soloLectura ? 'Volver' : 'Cancelar'}
        </Button>
        {!soloLectura && (
          <Button onClick={handleSubmit} isLoading={isPending}>
            <Icons.check className='mr-1 h-4 w-4' /> {isEdit ? 'Guardar cambios' : 'Emitir Instructivo'}
          </Button>
        )}
      </div>
    </div>
  )
}
