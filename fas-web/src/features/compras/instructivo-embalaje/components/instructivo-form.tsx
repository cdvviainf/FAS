'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Icons } from '@/components/icons'
import { createMantenedorService } from '@/features/mantenedor-simple/service'
import { articulosService } from '@/features/materiales/articulos/service'
import { notasVentaService } from '@/features/ventas/notas-venta/service'
import { instructivosEmbalajeKeys } from '../queries'
import { instructivoEmbalajeService } from '../service'
import type { InstructivoEmbalajeDetalleInput } from '../types'

const especiesService = createMantenedorService('especies')
const variedadesService = createMantenedorService('variedades')
const categoriasService = createMantenedorService('categorias')
const calibresService = createMantenedorService('calibres')

interface NuevaLinea {
  articuloId: number
  especieId: number
  variedadId: number
  categoriaId: number
  calibreMinId: number
  calibreMaxId: number
  cantidadPallets: string
  cajasPorPallet: string
}

const LINEA_EMPTY: NuevaLinea = {
  articuloId: 0,
  especieId: 0,
  variedadId: 0,
  categoriaId: 0,
  calibreMinId: 0,
  calibreMaxId: 0,
  cantidadPallets: '',
  cajasPorPallet: '',
}

export function InstructivoEmbalajeForm() {
  const router = useRouter()
  const queryClient = useQueryClient()

  const [notaVentaId, setNotaVentaId] = useState(0)
  const [detalle, setDetalle] = useState<InstructivoEmbalajeDetalleInput[]>([])
  const [linea, setLinea] = useState<NuevaLinea>(LINEA_EMPTY)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [lineaErrors, setLineaErrors] = useState<Record<string, string>>({})

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

  const especies = especiesData?.data ?? []
  const variedades = variedadesData?.data ?? []
  const categorias = categoriasData?.data ?? []
  const calibres = calibresData?.data ?? []
  const articulos = articulosData?.data ?? []

  function nombre(lista: { id: number; codigo?: string; descripcion: string }[], id: number) {
    const item = lista.find((i) => i.id === id)
    return item ? (item.codigo ? `${item.codigo} — ${item.descripcion}` : item.descripcion) : String(id)
  }

  function validarLinea(): boolean {
    const e: Record<string, string> = {}
    if (!linea.articuloId) e.articuloId = 'Requerido'
    if (!linea.especieId) e.especieId = 'Requerida'
    if (!linea.variedadId) e.variedadId = 'Requerida'
    if (!linea.categoriaId) e.categoriaId = 'Requerida'
    if (!linea.calibreMinId) e.calibreMinId = 'Requerido'
    if (!linea.calibreMaxId) e.calibreMaxId = 'Requerido'
    if (!linea.cantidadPallets || Number(linea.cantidadPallets) <= 0) e.cantidadPallets = 'Debe ser mayor a 0'
    if (!linea.cajasPorPallet || Number(linea.cajasPorPallet) <= 0) e.cajasPorPallet = 'Debe ser mayor a 0'
    setLineaErrors(e)
    return Object.keys(e).length === 0
  }

  function agregarLinea() {
    if (!validarLinea()) return
    setDetalle((prev) => [
      ...prev,
      {
        articuloId: linea.articuloId,
        especieId: linea.especieId,
        variedadId: linea.variedadId,
        categoriaId: linea.categoriaId,
        calibreMinId: linea.calibreMinId,
        calibreMaxId: linea.calibreMaxId,
        cantidadPallets: Number(linea.cantidadPallets),
        cajasPorPallet: Number(linea.cajasPorPallet),
      },
    ])
    setLinea(LINEA_EMPTY)
    setLineaErrors({})
  }

  function quitarLinea(index: number) {
    setDetalle((prev) => prev.filter((_, i) => i !== index))
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

  function validar(): boolean {
    const e: Record<string, string> = {}
    if (!notaVentaId) e.notaVentaId = 'La Nota de Venta (Cierre Comercial) es requerida'
    if (detalle.length === 0) e.detalle = 'Debe agregar al menos una línea'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit() {
    if (!validar()) return
    createMutation.mutate()
  }

  return (
    <div className='space-y-6'>
      <Card>
        <CardHeader>
          <CardTitle>Nuevo Instructivo de Embalaje</CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='space-y-1.5'>
            <Label>Cierre Comercial (Nota de Venta) <span className='text-destructive'>*</span></Label>
            <Select value={notaVentaId ? String(notaVentaId) : ''} onValueChange={(v) => setNotaVentaId(Number(v))}>
              <SelectTrigger><SelectValue placeholder='Seleccionar Nota de Venta...' /></SelectTrigger>
              <SelectContent>
                {(notasVentaData?.data ?? []).map((nv) => (
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
          {detalle.length > 0 && (
            <div className='space-y-2 rounded-md border p-2'>
              {detalle.map((d, i) => (
                <div key={i} className='flex flex-wrap items-center gap-2 border-b pb-2 text-sm last:border-b-0 last:pb-0'>
                  <span className='font-medium'>{nombre(especies, d.especieId)} / {nombre(variedades, d.variedadId)}</span>
                  <span className='text-muted-foreground'>{nombre(articulos, d.articuloId)}</span>
                  <span className='text-muted-foreground'>· {nombre(categorias, d.categoriaId)}</span>
                  <span className='text-muted-foreground'>· Calibre {nombre(calibres, d.calibreMinId)} a {nombre(calibres, d.calibreMaxId)}</span>
                  <span className='text-muted-foreground'>· {d.cantidadPallets} pallets × {d.cajasPorPallet} cj</span>
                  <Button type='button' variant='ghost' size='icon' className='ml-auto h-8 w-8' onClick={() => quitarLinea(i)}>
                    <Icons.trash className='h-4 w-4' />
                  </Button>
                </div>
              ))}
            </div>
          )}
          {errors.detalle && <p className='text-xs text-destructive'>{errors.detalle}</p>}

          <div className='grid gap-3 sm:grid-cols-2 md:grid-cols-3'>
            <div className='space-y-1.5'>
              <Label>Especie <span className='text-destructive'>*</span></Label>
              <Select value={linea.especieId ? String(linea.especieId) : ''} onValueChange={(v) => setLinea((l) => ({ ...l, especieId: Number(v), variedadId: 0, categoriaId: 0, calibreMinId: 0, calibreMaxId: 0 }))}>
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
            <div className='space-y-1.5'>
              <Label>Calibre Mínimo <span className='text-destructive'>*</span></Label>
              <Select value={linea.calibreMinId ? String(linea.calibreMinId) : ''} onValueChange={(v) => setLinea((l) => ({ ...l, calibreMinId: Number(v) }))} disabled={!linea.especieId}>
                <SelectTrigger><SelectValue placeholder='Seleccionar...' /></SelectTrigger>
                <SelectContent>
                  {calibres.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.descripcion}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {lineaErrors.calibreMinId && <p className='text-xs text-destructive'>{lineaErrors.calibreMinId}</p>}
            </div>
            <div className='space-y-1.5'>
              <Label>Calibre Máximo <span className='text-destructive'>*</span></Label>
              <Select value={linea.calibreMaxId ? String(linea.calibreMaxId) : ''} onValueChange={(v) => setLinea((l) => ({ ...l, calibreMaxId: Number(v) }))} disabled={!linea.especieId}>
                <SelectTrigger><SelectValue placeholder='Seleccionar...' /></SelectTrigger>
                <SelectContent>
                  {calibres.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.descripcion}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {lineaErrors.calibreMaxId && <p className='text-xs text-destructive'>{lineaErrors.calibreMaxId}</p>}
              <p className='text-xs text-muted-foreground'>El orden lo define el maestro de Calibres por especie.</p>
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
          </div>

          <div className='flex justify-end'>
            <Button type='button' variant='secondary' onClick={agregarLinea}>
              <Icons.add className='mr-1 h-4 w-4' /> Agregar línea
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className='flex justify-end gap-2'>
        <Button variant='outline' onClick={() => router.push('/dashboard/compras/instructivo-embalaje')} disabled={createMutation.isPending}>Cancelar</Button>
        <Button onClick={handleSubmit} isLoading={createMutation.isPending}>
          <Icons.check className='mr-1 h-4 w-4' /> Emitir Instructivo
        </Button>
      </div>
    </div>
  )
}
