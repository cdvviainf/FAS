'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null)

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

  function handleGuardarLinea() {
    if (!validarLinea()) return
    const nueva: InstructivoEmbalajeDetalleInput = {
      articuloId: linea.articuloId,
      especieId: linea.especieId,
      variedadId: linea.variedadId,
      categoriaId: linea.categoriaId,
      calibreMinId: linea.calibreMinId,
      calibreMaxId: linea.calibreMaxId,
      cantidadPallets: Number(linea.cantidadPallets),
      cajasPorPallet: Number(linea.cajasPorPallet),
    }
    if (editingIndex != null) {
      setDetalle((prev) => prev.map((d, i) => (i === editingIndex ? nueva : d)))
      setEditingIndex(null)
    } else {
      setDetalle((prev) => [...prev, nueva])
    }
    setLinea(LINEA_EMPTY)
    setLineaErrors({})
  }

  function handleEditarLinea(index: number) {
    const d = detalle[index]
    setEditingIndex(index)
    setLinea({
      articuloId: d.articuloId,
      especieId: d.especieId,
      variedadId: d.variedadId,
      categoriaId: d.categoriaId,
      calibreMinId: d.calibreMinId,
      calibreMaxId: d.calibreMaxId,
      cantidadPallets: String(d.cantidadPallets),
      cajasPorPallet: String(d.cajasPorPallet),
    })
    setLineaErrors({})
  }

  function handleCancelarEdicionLinea() {
    setEditingIndex(null)
    setLinea(LINEA_EMPTY)
    setLineaErrors({})
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

  function validar(): boolean {
    const e: Record<string, string> = {}
    if (!notaVentaId) e.notaVentaId = 'El Cierre Comercial es requerido'
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
            <Label>Cierre Comercial <span className='text-destructive'>*</span></Label>
            <Select value={notaVentaId ? String(notaVentaId) : ''} onValueChange={(v) => setNotaVentaId(Number(v))}>
              <SelectTrigger><SelectValue placeholder='Seleccionar Cierre Comercial...' /></SelectTrigger>
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
                      <TableCell className='whitespace-nowrap text-muted-foreground'>{nombre(calibres, d.calibreMinId)} – {nombre(calibres, d.calibreMaxId)}</TableCell>
                      <TableCell className='whitespace-nowrap text-muted-foreground'>{d.cantidadPallets} pallets × {d.cajasPorPallet} cj</TableCell>
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

      <div className='flex justify-end gap-2'>
        <Button variant='outline' onClick={() => router.push('/dashboard/compras/instructivo-embalaje')} disabled={createMutation.isPending}>Cancelar</Button>
        <Button onClick={handleSubmit} isLoading={createMutation.isPending}>
          <Icons.check className='mr-1 h-4 w-4' /> Emitir Instructivo
        </Button>
      </div>
    </div>
  )
}
