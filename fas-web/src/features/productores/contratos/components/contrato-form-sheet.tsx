'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Icons } from '@/components/icons'
import { createMantenedorService } from '@/features/mantenedor-simple/service'
import { articulosService } from '@/features/materiales/articulos/service'
import { condicionesPagoService } from '@/features/condiciones-pago/service'
import { usuariosService } from '@/features/usuarios/service'
import { contratosService } from '../service'
import type { Contrato, ContratoLineaInput } from '../types'

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

function nuevaLineaVacia(): ContratoLineaInput {
  return {
    articuloId: 0,
    variedadId: 0,
    calibreDesdeId: 0,
    calibreHastaId: 0,
    categoriaId: 0,
    unidadMedidaId: 0,
    cantidadComprometida: 0,
    minimoGarantizado: 0,
  }
}

interface ContratoFormSheetProps {
  entidadId: number
  item?: Contrato
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ContratoFormSheet({ entidadId, item, open, onOpenChange }: ContratoFormSheetProps) {
  const isEdit = !!item
  const queryClient = useQueryClient()

  const [temporadaId, setTemporadaId] = useState<number | null>(null)
  const [especieId, setEspecieId] = useState<number | null>(null)
  const [fechaInicio, setFechaInicio] = useState('')
  const [fechaTermino, setFechaTermino] = useState('')
  const [fechasTocadas, setFechasTocadas] = useState(false)
  const [condicionPagoId, setCondicionPagoId] = useState<number | null>(null)
  const [responsableId, setResponsableId] = useState<string | null>(null)
  const [lineas, setLineas] = useState<ContratoLineaInput[]>([nuevaLineaVacia()])
  const [errors, setErrors] = useState<Record<string, string>>({})

  const { data: temporadasData } = useQuery({
    queryKey: ['temporadas-options-contrato'],
    queryFn: () => temporadasService.list({ limit: 500 }) as unknown as Promise<{ data: TemporadaOption[] }>,
    staleTime: 60_000,
    enabled: open,
  })
  const { data: especiesData } = useQuery({
    queryKey: ['especies-options-contrato'],
    queryFn: () => especiesService.list({ limit: 200 }),
    staleTime: 5 * 60_000,
    enabled: open,
  })
  const { data: articulosData } = useQuery({
    queryKey: ['articulos-embalaje-options-contrato'],
    queryFn: () => articulosService.list({ limit: 500, tipo: 'EMBALAJE', activo: true }),
    staleTime: 60_000,
    enabled: open,
  })
  const { data: unidadesMedidaData } = useQuery({
    queryKey: ['unidades-medida-options-contrato'],
    queryFn: () => unidadesMedidaService.list({ limit: 200 }),
    staleTime: 5 * 60_000,
    enabled: open,
  })
  // Condición de Pago: mantenedor real CondicionPago, tipo COMPRA (Contrato
  // de Productor es un compromiso de compra al productor).
  const { data: condicionesPagoData } = useQuery({
    queryKey: ['condiciones-pago-options', 'COMPRA'],
    queryFn: () => condicionesPagoService.list({ tipo: 'COMPRA' }),
    staleTime: 60_000,
    enabled: open,
  })
  const { data: responsablesData } = useQuery({
    queryKey: ['usuarios-responsables-venta-options'],
    queryFn: () => usuariosService.list({ limit: 500, esResponsableVenta: true }),
    staleTime: 60_000,
    enabled: open,
  })

  const especies = especiesData?.data ?? []
  const articulos = articulosData?.data ?? []
  const unidadesMedida = unidadesMedidaData?.data ?? []
  const responsables = responsablesData?.data ?? []

  useEffect(() => {
    if (!open) return
    if (item) {
      setTemporadaId(item.temporadaId)
      setEspecieId(item.especieId)
      setFechaInicio(item.fechaInicio.slice(0, 10))
      setFechaTermino(item.fechaTermino.slice(0, 10))
      setFechasTocadas(true)
      setCondicionPagoId(item.condicionPagoId)
      setResponsableId(item.responsableId)
      setLineas(item.lineas.length > 0 ? item.lineas.map((l) => ({
        articuloId: l.articuloId,
        variedadId: l.variedadId,
        calibreDesdeId: l.calibreDesdeId,
        calibreHastaId: l.calibreHastaId,
        categoriaId: l.categoriaId,
        unidadMedidaId: l.unidadMedidaId,
        cantidadComprometida: Number(l.cantidadComprometida),
        minimoGarantizado: Number(l.minimoGarantizado),
      })) : [nuevaLineaVacia()])
    } else {
      setTemporadaId(null)
      setEspecieId(null)
      setFechaInicio('')
      setFechaTermino('')
      setFechasTocadas(false)
      setCondicionPagoId(null)
      setResponsableId(null)
      setLineas([nuevaLineaVacia()])
    }
    setErrors({})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item?.id])

  function seleccionarTemporada(id: number) {
    setTemporadaId(id)
    if (!fechasTocadas) {
      const temporada = (temporadasData?.data ?? []).find((t) => t.id === id)
      if (temporada) {
        setFechaInicio(temporada.fechaInicio.slice(0, 10))
        setFechaTermino(temporada.fechaTermino.slice(0, 10))
      }
    }
  }

  function actualizarLinea(index: number, cambios: Partial<ContratoLineaInput>) {
    setLineas((prev) => prev.map((l, i) => (i === index ? { ...l, ...cambios } : l)))
  }
  function agregarLinea() {
    setLineas((prev) => [...prev, nuevaLineaVacia()])
  }
  function quitarLinea(index: number) {
    setLineas((prev) => prev.filter((_, i) => i !== index))
  }

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!temporadaId) e.temporadaId = 'La temporada es requerida'
    if (!especieId) e.especieId = 'La especie es requerida'
    if (!fechaInicio) e.fechaInicio = 'La fecha de inicio es requerida'
    if (!fechaTermino) e.fechaTermino = 'La fecha de término es requerida'
    if (fechaInicio && fechaTermino && fechaInicio > fechaTermino) {
      e.fechaTermino = 'La fecha de término no puede ser anterior al inicio'
    }
    if (lineas.length === 0) e.lineas = 'Debe agregar al menos una línea de características'
    lineas.forEach((l, i) => {
      if (!l.articuloId || !l.variedadId || !l.calibreDesdeId || !l.calibreHastaId || !l.categoriaId || !l.unidadMedidaId) {
        e[`linea-${i}`] = `Línea ${i + 1}: completa todos los campos`
      }
      if (!l.cantidadComprometida || l.cantidadComprometida <= 0) {
        e[`linea-${i}-cant`] = `Línea ${i + 1}: la cantidad comprometida debe ser mayor a 0`
      }
    })
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        temporadaId: temporadaId!,
        especieId: especieId!,
        fechaInicio,
        fechaTermino,
        condicionPagoId,
        responsableId,
        lineas,
      }
      if (isEdit) return contratosService.update(entidadId, item!.id, payload)
      return contratosService.create(entidadId, payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productores', 'ficha', entidadId] })
      toast.success(isEdit ? 'Contrato actualizado' : 'Contrato creado')
      onOpenChange(false)
    },
    onError: (e: Error) => toast.error(e.message || 'Error al guardar el contrato'),
  })

  function handleSubmit() {
    if (!validate()) {
      toast.error('Hay campos por corregir')
      return
    }
    mutation.mutate()
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='flex w-full flex-col sm:max-w-3xl'>
        <SheetHeader>
          <SheetTitle>{isEdit ? 'Editar contrato' : 'Nuevo contrato'}</SheetTitle>
          <SheetDescription>Requiere que el productor tenga un representante legal registrado (R3).</SheetDescription>
        </SheetHeader>

        <div className='flex-1 space-y-4 overflow-auto px-1 py-2'>
          <Card>
            <CardHeader>
              <CardTitle className='text-sm'>Datos generales</CardTitle>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='grid gap-3 sm:grid-cols-2'>
                <div className='space-y-1.5'>
                  <Label>Temporada <span className='text-destructive'>*</span></Label>
                  <Select value={temporadaId ? String(temporadaId) : ''} onValueChange={(v) => seleccionarTemporada(Number(v))}>
                    <SelectTrigger><SelectValue placeholder='Seleccionar...' /></SelectTrigger>
                    <SelectContent>
                      {(temporadasData?.data ?? []).map((t) => (
                        <SelectItem key={t.id} value={String(t.id)}>{t.codigo} — {t.descripcion}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.temporadaId && <p className='text-xs text-destructive'>{errors.temporadaId}</p>}
                </div>
                <div className='space-y-1.5'>
                  <Label>Especie <span className='text-destructive'>*</span></Label>
                  <Select
                    value={especieId ? String(especieId) : ''}
                    onValueChange={(v) => {
                      setEspecieId(Number(v))
                      setLineas([nuevaLineaVacia()])
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder='Seleccionar...' /></SelectTrigger>
                    <SelectContent>
                      {especies.map((e) => (
                        <SelectItem key={e.id} value={String(e.id)}>{e.descripcion}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.especieId && <p className='text-xs text-destructive'>{errors.especieId}</p>}
                </div>
              </div>

              <div className='grid gap-3 sm:grid-cols-3'>
                <div className='space-y-1.5'>
                  <Label>Fecha inicio <span className='text-destructive'>*</span></Label>
                  <Input
                    type='date'
                    value={fechaInicio}
                    onChange={(e) => { setFechaInicio(e.target.value); setFechasTocadas(true) }}
                  />
                  {errors.fechaInicio && <p className='text-xs text-destructive'>{errors.fechaInicio}</p>}
                </div>
                <div className='space-y-1.5'>
                  <Label>Fecha término <span className='text-destructive'>*</span></Label>
                  <Input
                    type='date'
                    value={fechaTermino}
                    onChange={(e) => { setFechaTermino(e.target.value); setFechasTocadas(true) }}
                  />
                  {errors.fechaTermino && <p className='text-xs text-destructive'>{errors.fechaTermino}</p>}
                </div>
                <div className='space-y-1.5'>
                  <Label>Responsable</Label>
                  <Select value={responsableId ?? '__none__'} onValueChange={(v) => setResponsableId(v === '__none__' ? null : v)}>
                    <SelectTrigger><SelectValue placeholder='Sin definir' /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value='__none__'>Sin definir</SelectItem>
                      {responsables.map((u) => (
                        <SelectItem key={u.id} value={u.id}>{u.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className='space-y-1.5'>
                <Label>Condición de Pago</Label>
                <Select
                  value={condicionPagoId ? String(condicionPagoId) : '__none__'}
                  onValueChange={(v) => setCondicionPagoId(v === '__none__' ? null : Number(v))}
                >
                  <SelectTrigger><SelectValue placeholder='Sin definir' /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value='__none__'>Sin definir</SelectItem>
                    {(condicionesPagoData?.data ?? []).map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.descripcion}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className='text-sm'>Características de la fruta</CardTitle>
            </CardHeader>
            <CardContent className='space-y-4'>
              {errors.lineas && <p className='text-xs text-destructive'>{errors.lineas}</p>}
              {lineas.map((linea, i) => (
                <LineaContrato
                  key={i}
                  linea={linea}
                  index={i}
                  especieId={especieId}
                  articulos={articulos}
                  unidadesMedida={unidadesMedida}
                  variedadesService={variedadesService}
                  categoriasService={categoriasService}
                  calibresService={calibresService}
                  onChange={(cambios) => actualizarLinea(i, cambios)}
                  onRemove={() => quitarLinea(i)}
                  error={errors[`linea-${i}`] ?? errors[`linea-${i}-cant`]}
                  puedeQuitar={lineas.length > 1}
                />
              ))}
              <Button type='button' variant='secondary' size='sm' onClick={agregarLinea} disabled={!especieId}>
                <Icons.add className='mr-1 h-4 w-4' /> Agregar línea
              </Button>
            </CardContent>
          </Card>
        </div>

        <SheetFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)} disabled={mutation.isPending}>Cancelar</Button>
          <Button onClick={handleSubmit} isLoading={mutation.isPending}>
            <Icons.check className='mr-1 h-4 w-4' /> {isEdit ? 'Guardar cambios' : 'Crear contrato'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

interface LineaContratoProps {
  linea: ContratoLineaInput
  index: number
  especieId: number | null
  articulos: { id: number; codigo: string; descripcion: string }[]
  unidadesMedida: { id: number; codigo: string; descripcion: string }[]
  variedadesService: ReturnType<typeof createMantenedorService>
  categoriasService: ReturnType<typeof createMantenedorService>
  calibresService: ReturnType<typeof createMantenedorService>
  onChange: (cambios: Partial<ContratoLineaInput>) => void
  onRemove: () => void
  error?: string
  puedeQuitar: boolean
}

function LineaContrato({
  linea, index, especieId, articulos, unidadesMedida,
  variedadesService, categoriasService, calibresService,
  onChange, onRemove, error, puedeQuitar,
}: LineaContratoProps) {
  const { data: variedadesData } = useQuery({ queryKey: ['variedades-options-contrato', especieId], queryFn: () => variedadesService.list({ limit: 200, especieId: especieId! }), staleTime: 60_000, enabled: !!especieId })
  const { data: categoriasData } = useQuery({ queryKey: ['categorias-options-contrato', especieId], queryFn: () => categoriasService.list({ limit: 200, especieId: especieId! }), staleTime: 60_000, enabled: !!especieId })
  const { data: calibresData } = useQuery({ queryKey: ['calibres-options-contrato', especieId], queryFn: () => calibresService.list({ limit: 200, especieId: especieId! }), staleTime: 60_000, enabled: !!especieId })

  const articuloSeleccionado = articulos.find((a) => a.id === linea.articuloId) as { etiqueta?: { descripcion: string } | null; kgNetoEnvase?: string | null; kgBrutoEnvase?: string | null } | undefined

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
      <div className='grid gap-3 sm:grid-cols-2 md:grid-cols-3'>
        <div className='space-y-1.5'>
          <Label className='text-xs'>Embalaje</Label>
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
          <Label className='text-xs'>Variedad</Label>
          <Select value={linea.variedadId ? String(linea.variedadId) : ''} onValueChange={(v) => onChange({ variedadId: Number(v) })} disabled={!especieId}>
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
          <Select value={linea.categoriaId ? String(linea.categoriaId) : ''} onValueChange={(v) => onChange({ categoriaId: Number(v) })} disabled={!especieId}>
            <SelectTrigger><SelectValue placeholder='Seleccionar...' /></SelectTrigger>
            <SelectContent>
              {(categoriasData?.data ?? []).map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>{c.descripcion}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className='space-y-1.5'>
          <Label className='text-xs'>Calibre desde</Label>
          <Select value={linea.calibreDesdeId ? String(linea.calibreDesdeId) : ''} onValueChange={(v) => onChange({ calibreDesdeId: Number(v) })} disabled={!especieId}>
            <SelectTrigger><SelectValue placeholder='Seleccionar...' /></SelectTrigger>
            <SelectContent>
              {(calibresData?.data ?? []).map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>{c.descripcion}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className='space-y-1.5'>
          <Label className='text-xs'>Calibre hasta</Label>
          <Select value={linea.calibreHastaId ? String(linea.calibreHastaId) : ''} onValueChange={(v) => onChange({ calibreHastaId: Number(v) })} disabled={!especieId}>
            <SelectTrigger><SelectValue placeholder='Seleccionar...' /></SelectTrigger>
            <SelectContent>
              {(calibresData?.data ?? []).map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>{c.descripcion}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className='space-y-1.5'>
          <Label className='text-xs'>Unidad de medida</Label>
          <Select value={linea.unidadMedidaId ? String(linea.unidadMedidaId) : ''} onValueChange={(v) => onChange({ unidadMedidaId: Number(v) })}>
            <SelectTrigger><SelectValue placeholder='Seleccionar...' /></SelectTrigger>
            <SelectContent>
              {unidadesMedida.map((u) => (
                <SelectItem key={u.id} value={String(u.id)}>{u.descripcion}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className='space-y-1.5'>
          <Label className='text-xs'>Cantidad comprometida</Label>
          <Input type='number' step='0.001' value={linea.cantidadComprometida || ''} onChange={(e) => onChange({ cantidadComprometida: Number(e.target.value) })} />
        </div>
        <div className='space-y-1.5'>
          <Label className='text-xs'>Mínimo garantizado</Label>
          <Input type='number' step='0.0001' value={linea.minimoGarantizado || ''} onChange={(e) => onChange({ minimoGarantizado: Number(e.target.value) })} />
        </div>
      </div>
      {articuloSeleccionado && (articuloSeleccionado.etiqueta || articuloSeleccionado.kgNetoEnvase) && (
        <p className='text-xs text-muted-foreground'>
          Etiqueta: {articuloSeleccionado.etiqueta?.descripcion ?? '—'} · Kg Neto: {articuloSeleccionado.kgNetoEnvase ?? '—'} · Kg Bruto: {articuloSeleccionado.kgBrutoEnvase ?? '—'}
        </p>
      )}
      {error && <p className='text-xs text-destructive'>{error}</p>}
      <Separator className='mt-2' />
    </div>
  )
}
