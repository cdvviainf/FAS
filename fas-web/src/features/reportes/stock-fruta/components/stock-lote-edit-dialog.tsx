'use client'

import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Combobox } from '@/components/ui/combobox'
import { Icons } from '@/components/icons'
import { cn } from '@/lib/utils'
import { createMantenedorService } from '@/features/mantenedor-simple/service'
import { articulosService } from '@/features/materiales/articulos/service'
import { entidadesService } from '@/features/entidades/service'
import { notasCalidadService } from '@/features/notas-calidad/service'
import { notasCondicionService } from '@/features/notas-condicion/service'
import { stockFrutaService } from '../service'
import type { LoteLineaInput } from '../types'

const NINGUNO = '__NINGUNO__'
const especiesService = createMantenedorService('especies')
const variedadesService = createMantenedorService('variedades')
const categoriasService = createMantenedorService('categorias')
const calibresService = createMantenedorService('calibres')
const etiquetasService = createMantenedorService('etiquetas')

interface Props {
  palletId: number | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

function lineaVacia(): LoteLineaInput {
  return { especieId: 0, variedadId: 0, categoriaId: 0, articuloId: 0, calibreId: 0, cajas: 1, fechaEmbalaje: null, etiquetaId: null, packingId: null }
}

// Los mantenedores dependientes (variedad/categoría/calibre) traen `especieId`
// en el payload de la API aunque el tipo MantenedorSimple no lo declare.
type ItemMantenedor = { id: number; descripcion: string; especieId?: number }

function toOptions(arr: { id: number; descripcion: string }[] | undefined) {
  return (arr ?? []).map((o) => ({ value: String(o.id), label: o.descripcion }))
}

// Solo los ítems de la especie de la línea; sin especie elegida, ninguno.
function porEspecie(arr: ItemMantenedor[] | undefined, especieId: number): ItemMantenedor[] {
  if (!especieId) return []
  return (arr ?? []).filter((o) => o.especieId === especieId)
}

export function StockLoteEditDialog({ palletId, open, onOpenChange }: Props) {
  const queryClient = useQueryClient()
  const [productorId, setProductorId] = useState<string>(NINGUNO)
  const [notaCalidadId, setNotaCalidadId] = useState<string>(NINGUNO)
  const [notaCondicionId, setNotaCondicionId] = useState<string>(NINGUNO)
  const [completo, setCompleto] = useState(false)
  const [lineas, setLineas] = useState<LoteLineaInput[]>([])

  const { data: loteData, isPending } = useQuery({
    queryKey: ['stock-lote', palletId],
    queryFn: () => stockFrutaService.obtenerLote(palletId!),
    enabled: open && palletId != null,
  })

  useEffect(() => {
    if (!open || !loteData?.data) return
    const l = loteData.data
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hidratación al abrir
    setProductorId(String(l.productorId))
    setNotaCalidadId(l.notaCalidadId != null ? String(l.notaCalidadId) : NINGUNO)
    setNotaCondicionId(l.notaCondicionId != null ? String(l.notaCondicionId) : NINGUNO)
    setCompleto(l.completo)
    setLineas(
      l.lineas.map((x) => ({
        id: x.id,
        especieId: x.especieId,
        variedadId: x.variedadId,
        categoriaId: x.categoriaId,
        articuloId: x.articuloId,
        calibreId: x.calibreId,
        cajas: x.cajas,
        fechaEmbalaje: x.fechaEmbalaje ? x.fechaEmbalaje.slice(0, 10) : null,
        etiquetaId: x.etiquetaId,
        packingId: x.packingId,
      })),
    )
  }, [open, loteData])

  const opts = { limit: 500, soloActivos: true } as const
  const { data: especies } = useQuery({ queryKey: ['especies-options'], queryFn: () => especiesService.list(opts), enabled: open, staleTime: 5 * 60_000 })
  const { data: variedades } = useQuery({ queryKey: ['variedades-options'], queryFn: () => variedadesService.list(opts), enabled: open, staleTime: 5 * 60_000 })
  const { data: categorias } = useQuery({ queryKey: ['categorias-options'], queryFn: () => categoriasService.list(opts), enabled: open, staleTime: 5 * 60_000 })
  const { data: calibres } = useQuery({ queryKey: ['calibres-options'], queryFn: () => calibresService.list(opts), enabled: open, staleTime: 5 * 60_000 })
  const { data: etiquetas } = useQuery({ queryKey: ['etiquetas-options'], queryFn: () => etiquetasService.list(opts), enabled: open, staleTime: 5 * 60_000 })
  const { data: articulos } = useQuery({ queryKey: ['articulos-embalaje-options'], queryFn: () => articulosService.list({ tipo: 'EMBALAJE', activo: true, limit: 500 }), enabled: open, staleTime: 5 * 60_000 })
  const { data: productores } = useQuery({ queryKey: ['entidades-productor-options'], queryFn: () => entidadesService.list({ tipo: 'PRODUCTOR', activo: true, limit: 500 }), enabled: open, staleTime: 5 * 60_000 })
  const { data: packings } = useQuery({ queryKey: ['entidades-packing-options'], queryFn: () => entidadesService.list({ tipo: 'PACKING', activo: true, limit: 500 }), enabled: open, staleTime: 5 * 60_000 })
  const { data: notasCalidad } = useQuery({ queryKey: ['notas-calidad'], queryFn: () => notasCalidadService.list(), enabled: open, staleTime: 60_000 })
  const { data: notasCondicion } = useQuery({ queryKey: ['notas-condicion'], queryFn: () => notasCondicionService.list(), enabled: open, staleTime: 60_000 })

  function setLinea(i: number, cambios: Partial<LoteLineaInput>) {
    setLineas((prev) => prev.map((l, j) => (j === i ? { ...l, ...cambios } : l)))
  }

  const guardar = useMutation({
    mutationFn: () =>
      stockFrutaService.editarLote(palletId!, {
        productorId: productorId !== NINGUNO ? Number(productorId) : undefined,
        notaCalidadId: notaCalidadId !== NINGUNO ? Number(notaCalidadId) : null,
        notaCondicionId: notaCondicionId !== NINGUNO ? Number(notaCondicionId) : null,
        completo,
        lineas,
      }),
    onSuccess: () => {
      toast.success('Lote actualizado')
      queryClient.invalidateQueries({ queryKey: ['stock-fruta'] })
      queryClient.invalidateQueries({ queryKey: ['gestion-pallets'] })
      onOpenChange(false)
    },
    onError: (e: Error) => toast.error(e.message || 'Error al guardar el lote'),
  })

  function handleGuardar() {
    if (lineas.length === 0) {
      toast.error('El lote debe tener al menos una línea')
      return
    }
    for (const l of lineas) {
      if (!l.especieId || !l.variedadId || !l.categoriaId || !l.articuloId || !l.calibreId || l.cajas < 1) {
        toast.error('Completa especie, variedad, categoría, artículo, calibre y cajas en todas las líneas')
        return
      }
    }
    guardar.mutate()
  }

  const bloqueado = loteData?.data?.embarqueId != null
  const optSelect = (arr: { id: number; descripcion: string }[] | undefined) =>
    (arr ?? []).map((o) => <SelectItem key={o.id} value={String(o.id)}>{o.descripcion}</SelectItem>)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* sm:max-w-* con prefijo: sin el prefijo, el sm:max-w-lg de la base de
          DialogContent gana en sm+ (tailwind-merge no los deduplica por ser
          variantes distintas) y capaba el modal en ~512px — con 9 columnas
          quedaba ilegible. 6xl da ~128px por columna. */}
      <DialogContent className='max-h-[90vh] w-[95vw] overflow-auto sm:max-w-6xl'>
        <DialogHeader>
          <DialogTitle>Editar lote {loteData?.data?.numeroPallet ? `— Pallet ${loteData.data.numeroPallet}` : ''}</DialogTitle>
          <DialogDescription>Modifica las características del lote, agrega o elimina líneas.</DialogDescription>
        </DialogHeader>

        {isPending ? (
          <p className='text-muted-foreground text-sm'>Cargando...</p>
        ) : bloqueado ? (
          <p className='text-destructive text-sm'>Este lote está reservado a un Embarque o despachado — no se puede editar.</p>
        ) : (
          <div className='space-y-4'>
            <div className='grid grid-cols-2 gap-3 sm:grid-cols-4'>
              <div className='min-w-0 space-y-1.5'>
                <Label>Productor</Label>
                <Combobox
                  options={toOptions(productores?.data)}
                  value={productorId !== NINGUNO ? productorId : null}
                  onChange={setProductorId}
                  placeholder='Seleccionar productor...'
                  searchPlaceholder='Buscar productor...'
                />
              </div>
              <div className='space-y-1.5'>
                <Label>Nota Calidad</Label>
                <Select value={notaCalidadId} onValueChange={setNotaCalidadId}>
                  <SelectTrigger><SelectValue placeholder='—' /></SelectTrigger>
                  <SelectContent><SelectItem value={NINGUNO}>—</SelectItem>{optSelect(notasCalidad?.data)}</SelectContent>
                </Select>
              </div>
              <div className='space-y-1.5'>
                <Label>Nota Condición</Label>
                <Select value={notaCondicionId} onValueChange={setNotaCondicionId}>
                  <SelectTrigger><SelectValue placeholder='—' /></SelectTrigger>
                  <SelectContent><SelectItem value={NINGUNO}>—</SelectItem>{optSelect(notasCondicion?.data)}</SelectContent>
                </Select>
              </div>
              <div className='flex items-end gap-2'>
                <Switch id='lote-completo' checked={completo} onCheckedChange={setCompleto} />
                <Label htmlFor='lote-completo'>Completo</Label>
              </div>
            </div>

            <div className='space-y-2'>
              <div className='flex items-center justify-between'>
                <Label>Líneas</Label>
                <Button
                  type='button'
                  variant='ghost'
                  size='sm'
                  onClick={() => setLineas((prev) => {
                    // Replica los datos de la última línea (salvo el `id`, que
                    // identifica la fila existente en BD — sin esto, guardar
                    // duplicaría la edición sobre la línea original en vez de
                    // crear una nueva).
                    const ultima = prev[prev.length - 1]
                    const nueva: LoteLineaInput = ultima ? { ...ultima, id: undefined } : lineaVacia()
                    return [...prev, nueva]
                  })}
                >
                  <Icons.add className='mr-1 h-4 w-4' /> Agregar línea
                </Button>
              </div>
              {lineas.map((l, i) => (
                <div key={i} className='grid grid-cols-2 items-end gap-2 rounded-md border p-2 sm:grid-cols-3 lg:grid-cols-6'>
                  {/* Fila 1: identificación de la fruta (Variedad/Categoría/
                      Calibre dependen de la Especie de la línea) */}
                  <SelectField
                    label='Especie'
                    value={l.especieId}
                    // Cambiar especie limpia los dependientes (variedad/categoría/
                    // calibre) para no dejar combinaciones inválidas.
                    onChange={(v) => setLinea(i, { especieId: v, variedadId: 0, categoriaId: 0, calibreId: 0 })}
                    items={especies?.data}
                  />
                  <SelectField
                    label='Variedad'
                    value={l.variedadId}
                    onChange={(v) => setLinea(i, { variedadId: v })}
                    items={porEspecie(variedades?.data as ItemMantenedor[] | undefined, l.especieId)}
                    disabled={!l.especieId}
                  />
                  <SelectField
                    label='Categoría'
                    value={l.categoriaId}
                    onChange={(v) => setLinea(i, { categoriaId: v })}
                    items={porEspecie(categorias?.data as ItemMantenedor[] | undefined, l.especieId)}
                    disabled={!l.especieId}
                  />
                  <SelectField
                    label='Calibre'
                    value={l.calibreId}
                    onChange={(v) => setLinea(i, { calibreId: v })}
                    items={porEspecie(calibres?.data as ItemMantenedor[] | undefined, l.especieId)}
                    disabled={!l.especieId}
                  />
                  <div className='min-w-0 space-y-1'>
                    <Label className='text-[10px] uppercase'>F. Embalaje</Label>
                    <Input type='date' value={l.fechaEmbalaje ?? ''} onChange={(e) => setLinea(i, { fechaEmbalaje: e.target.value || null })} className='h-8 w-full' />
                  </div>
                  <div className='min-w-0 space-y-1'>
                    <Label className='text-[10px] uppercase'>Etiqueta</Label>
                    <Combobox
                      options={[{ value: NINGUNO, label: '—' }, ...toOptions(etiquetas?.data)]}
                      value={l.etiquetaId ? String(l.etiquetaId) : NINGUNO}
                      onChange={(v) => setLinea(i, { etiquetaId: v === NINGUNO ? null : Number(v) })}
                      placeholder='—'
                      searchPlaceholder='Buscar etiqueta...'
                      className='h-8'
                    />
                  </div>

                  {/* Fila 2: Artículo (2 col) · Packing (2 col) · Cajas · eliminar */}
                  <div className='min-w-0 space-y-1 sm:col-span-2'>
                    <Label className='text-[10px] uppercase'>Artículo</Label>
                    <Combobox
                      options={toOptions(articulos?.data)}
                      value={l.articuloId ? String(l.articuloId) : null}
                      onChange={(v) => setLinea(i, { articuloId: Number(v) })}
                      placeholder='—'
                      searchPlaceholder='Buscar artículo...'
                      className='h-8'
                    />
                  </div>
                  <SelectField label='Packing' value={l.packingId ?? 0} onChange={(v) => setLinea(i, { packingId: v || null })} items={packings?.data} nullable className='sm:col-span-2' />
                  <div className='min-w-0 space-y-1'>
                    <Label className='text-[10px] uppercase'>Cajas</Label>
                    <Input type='number' min={1} value={l.cajas} onChange={(e) => setLinea(i, { cajas: Math.max(1, Math.trunc(Number(e.target.value) || 0)) })} className='h-8 w-full' />
                  </div>
                  <div className='flex items-end justify-end'>
                    <Button type='button' variant='ghost' size='icon' className='h-8 w-8 shrink-0' onClick={() => setLineas((prev) => prev.filter((_, j) => j !== i))}>
                      <Icons.trash className='h-4 w-4' />
                    </Button>
                  </div>
                </div>
              ))}
              {lineas.length === 0 && <p className='text-muted-foreground text-xs italic'>Sin líneas — agrega al menos una.</p>}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)} disabled={guardar.isPending}>Cancelar</Button>
          <Button onClick={handleGuardar} isLoading={guardar.isPending} disabled={bloqueado || isPending}>
            <Icons.check className='mr-1 h-4 w-4' /> Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SelectField({
  label,
  value,
  onChange,
  items,
  nullable,
  disabled,
  className,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  items: { id: number; descripcion: string }[] | undefined
  nullable?: boolean
  disabled?: boolean
  className?: string
}) {
  const NADA = '__NADA__'
  return (
    <div className={cn('min-w-0 space-y-1', className)}>
      <Label className='text-[10px] uppercase'>{label}</Label>
      <Select value={value ? String(value) : NADA} onValueChange={(v) => onChange(v === NADA ? 0 : Number(v))} disabled={disabled}>
        {/* w-full min-w-0: la base del SelectTrigger usa w-fit y desbordaba la
            celda tapando el campo siguiente; con esto se ajusta y trunca. */}
        <SelectTrigger className='h-8 w-full min-w-0'><SelectValue placeholder='—' /></SelectTrigger>
        <SelectContent>
          {nullable && <SelectItem value={NADA}>—</SelectItem>}
          {(items ?? []).map((o) => <SelectItem key={o.id} value={String(o.id)}>{o.descripcion}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  )
}
