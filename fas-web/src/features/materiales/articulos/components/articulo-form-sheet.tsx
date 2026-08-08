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
import { Switch } from '@/components/ui/switch'
import { Icons } from '@/components/icons'
import { createMantenedorService } from '@/features/mantenedor-simple/service'
import { UnidadMedidaQuickCreate } from '@/features/unidades-medida/components/unidad-medida-quick-create'
import { EtiquetaQuickCreate } from '@/features/etiquetas/components/etiqueta-quick-create'
import { usePuedeEscribir } from '@/hooks/use-item-acceso'
import { prefijosCodigoService } from '@/features/prefijos-codigo/service'
import { articulosService } from '../service'
import { articulosKeys } from '../queries'
import { TIPO_ARTICULO_LABELS, TIPO_COSTEO_LABELS } from '../types'
import type { Articulo, TipoArticulo, TipoCosteo } from '../types'

const unidadesService = createMantenedorService('unidades-medida')
const etiquetasService = createMantenedorService('etiquetas')
const ITEM = 'OPER_MATERIALES'

interface ArticuloFormSheetProps {
  item?: Articulo
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ArticuloFormSheet({ item, open, onOpenChange }: ArticuloFormSheetProps) {
  const isEdit = !!item
  const queryClient = useQueryClient()

  const [tipo, setTipo] = useState<TipoArticulo>('MATERIAL_EMBALAJE')
  const [codigo, setCodigo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [descripcionExtranjera, setDescripcionExtranjera] = useState('')
  const [unidadId, setUnidadId] = useState<number | null>(null)
  const [tipoCosteo, setTipoCosteo] = useState<TipoCosteo>('PROMEDIO_PONDERADO')
  const [valorEstandar, setValorEstandar] = useState('')
  const [stockCritico, setStockCritico] = useState('')
  const [activo, setActivo] = useState(true)
  const [etiquetaId, setEtiquetaId] = useState<number | null>(null)
  const [kgNetoEnvase, setKgNetoEnvase] = useState('')
  const [kgBrutoEnvase, setKgBrutoEnvase] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const { data: unidades } = useQuery({
    queryKey: ['unidades-medida-options'],
    queryFn: () => unidadesService.list({ soloActivos: true, limit: 500 }),
    staleTime: 60_000,
    enabled: open,
  })

  const { data: etiquetas } = useQuery({
    queryKey: ['etiquetas-options'],
    queryFn: () => etiquetasService.list({ soloActivos: true, limit: 500 }),
    staleTime: 60_000,
    enabled: open,
  })

  // Sugerencia de código (Prefijos de Código) — solo al crear.
  const { data: codigoSugerido } = useQuery({
    queryKey: ['prefijo-codigo-siguiente', 'articulo'],
    queryFn: () => prefijosCodigoService.siguienteCodigo('articulo'),
    enabled: open && !item,
    staleTime: 0,
  })

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open && !item && codigoSugerido) setCodigo(codigoSugerido)
  }, [codigoSugerido, open, item])

  useEffect(() => {
    if (!open) return
    setErrors({})
    if (item) {
      setTipo(item.tipo)
      setCodigo(item.codigo)
      setDescripcion(item.descripcion)
      setDescripcionExtranjera(item.descripcionExtranjera ?? '')
      setUnidadId(item.unidadId)
      setTipoCosteo(item.tipoCosteo)
      setValorEstandar(item.valorEstandar ?? '')
      setStockCritico(item.stockCritico ?? '')
      setActivo(item.activo)
      setEtiquetaId(item.etiquetaId)
      setKgNetoEnvase(item.kgNetoEnvase ?? '')
      setKgBrutoEnvase(item.kgBrutoEnvase ?? '')
    } else {
      setTipo('MATERIAL_EMBALAJE')
      setCodigo('')
      setDescripcion('')
      setDescripcionExtranjera('')
      setUnidadId(null)
      setTipoCosteo('PROMEDIO_PONDERADO')
      setValorEstandar('')
      setStockCritico('')
      setActivo(true)
      setEtiquetaId(null)
      setKgNetoEnvase('')
      setKgBrutoEnvase('')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item?.id])


  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        tipo,
        descripcion: descripcion.trim(),
        descripcionExtranjera: descripcionExtranjera.trim() || null,
        unidadId: unidadId!,
        tipoCosteo,
        valorEstandar: valorEstandar ? Number(valorEstandar) : null,
        stockCritico: stockCritico ? Number(stockCritico) : null,
        activo,
        etiquetaId: tipo === 'EMBALAJE' ? etiquetaId : null,
        kgNetoEnvase: tipo === 'EMBALAJE' && kgNetoEnvase ? Number(kgNetoEnvase) : null,
        kgBrutoEnvase: tipo === 'EMBALAJE' && kgBrutoEnvase ? Number(kgBrutoEnvase) : null,
      }
      if (isEdit) {
        return articulosService.update(item!.id, payload)
      }
      return articulosService.create({ ...payload, codigo: codigo.trim() })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: articulosKeys.all })
      toast.success(isEdit ? 'Artículo actualizado' : 'Artículo creado')
      onOpenChange(false)
    },
    onError: (e: Error) => toast.error(e.message || 'Error al guardar el artículo'),
  })

  function validar(): boolean {
    const e: Record<string, string> = {}
    if (!isEdit && !codigo.trim()) e.codigo = 'El código es requerido'
    if (!descripcion.trim()) e.descripcion = 'La descripción es requerida'
    if (!unidadId) e.unidadId = 'La unidad de medida es requerida'
    if (tipoCosteo === 'ESTANDAR' && !valorEstandar) e.valorEstandar = 'El valor estándar es requerido (R3)'
    if (tipo === 'EMBALAJE' && !etiquetaId) e.etiquetaId = 'La etiqueta es requerida para artículos de tipo Embalaje'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit() {
    if (!validar()) return
    mutation.mutate()
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='flex w-full flex-col sm:max-w-lg'>
        <SheetHeader>
          <SheetTitle>{isEdit ? `Editar artículo ${item?.codigo}` : 'Nuevo artículo'}</SheetTitle>
          <SheetDescription>Embalajes, envases, materiales de embalaje y servicios.</SheetDescription>
        </SheetHeader>

        <div className='flex-1 space-y-4 overflow-auto px-1 py-2'>
          <div className='grid grid-cols-2 gap-3'>
            <div className='space-y-1.5'>
              <Label>Tipo <span className='text-destructive'>*</span></Label>
              <Select
                value={tipo}
                onValueChange={(v) => {
                  const nuevoTipo = v as TipoArticulo
                  setTipo(nuevoTipo)
                  // Sugerencia de costeo al cambiar el tipo (R4: Servicio siempre Estándar;
                  // el resto sugiere Promedio Ponderado, editable por el usuario).
                  setTipoCosteo(nuevoTipo === 'SERVICIO' ? 'ESTANDAR' : 'PROMEDIO_PONDERADO')
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(TIPO_ARTICULO_LABELS) as TipoArticulo[]).map((t) => (
                    <SelectItem key={t} value={t}>{TIPO_ARTICULO_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className='space-y-1.5'>
              <Label>Código <span className='text-destructive'>*</span></Label>
              <Input value={codigo} onChange={(e) => setCodigo(e.target.value)} disabled={isEdit} placeholder='EMB-001' />
              {errors.codigo && <p className='text-xs text-destructive'>{errors.codigo}</p>}
            </div>
          </div>

          <div className='space-y-1.5'>
            <Label>Descripción <span className='text-destructive'>*</span></Label>
            <Input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder='Ej: Caja Madera Uva 8.2 kg' />
            {errors.descripcion && <p className='text-xs text-destructive'>{errors.descripcion}</p>}
          </div>

          <div className='space-y-1.5'>
            <Label>Descripción extranjera</Label>
            <Input value={descripcionExtranjera} onChange={(e) => setDescripcionExtranjera(e.target.value)} />
          </div>

          <div className='space-y-1.5'>
            <Label>Unidad de medida <span className='text-destructive'>*</span></Label>
            <div className='flex items-end gap-2'>
              <div className='flex-1'>
                <Select value={unidadId ? String(unidadId) : ''} onValueChange={(v) => setUnidadId(parseInt(v))}>
                  <SelectTrigger><SelectValue placeholder='Seleccionar unidad...' /></SelectTrigger>
                  <SelectContent>
                    {(unidades?.data ?? []).map((u) => (
                      <SelectItem key={u.id} value={String(u.id)}>{u.descripcion}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <UnidadMedidaQuickCreate onCreated={(u) => {
                queryClient.invalidateQueries({ queryKey: ['unidades-medida-options'] })
                setUnidadId(u.id)
              }} />
            </div>
            {errors.unidadId && <p className='text-xs text-destructive'>{errors.unidadId}</p>}
          </div>

          <div className='space-y-1.5'>
            <Label>Tipo de costeo <span className='text-destructive'>*</span></Label>
            <Select value={tipoCosteo} onValueChange={(v) => setTipoCosteo(v as TipoCosteo)} disabled={tipo === 'SERVICIO'}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(TIPO_COSTEO_LABELS) as TipoCosteo[]).map((t) => (
                  <SelectItem key={t} value={t}>{TIPO_COSTEO_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {tipo === 'SERVICIO' && (
              <p className='text-xs text-muted-foreground'>Los servicios siempre usan costeo Estándar (R4).</p>
            )}
          </div>

          {tipoCosteo === 'ESTANDAR' ? (
            <div className='space-y-1.5'>
              <Label>Valor estándar <span className='text-destructive'>*</span></Label>
              <Input type='number' step='0.01' value={valorEstandar} onChange={(e) => setValorEstandar(e.target.value)} />
              {errors.valorEstandar && <p className='text-xs text-destructive'>{errors.valorEstandar}</p>}
            </div>
          ) : (
            <div className='space-y-1.5'>
              <Label>Stock crítico</Label>
              <Input type='number' step='0.001' value={stockCritico} onChange={(e) => setStockCritico(e.target.value)} />
              <p className='text-xs text-muted-foreground'>Este artículo controla stock (Promedio Ponderado).</p>
            </div>
          )}

          {tipo === 'EMBALAJE' && (
            <>
              <div className='space-y-1.5'>
                <Label>Etiqueta <span className='text-destructive'>*</span></Label>
                <div className='flex items-end gap-2'>
                  <div className='flex-1'>
                    <Select value={etiquetaId ? String(etiquetaId) : ''} onValueChange={(v) => setEtiquetaId(parseInt(v))}>
                      <SelectTrigger><SelectValue placeholder='Seleccionar etiqueta...' /></SelectTrigger>
                      <SelectContent>
                        {(etiquetas?.data ?? []).map((e) => (
                          <SelectItem key={e.id} value={String(e.id)}>{e.descripcion}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <EtiquetaQuickCreate onCreated={(e) => {
                    queryClient.invalidateQueries({ queryKey: ['etiquetas-options'] })
                    setEtiquetaId(e.id)
                  }} />
                </div>
                {errors.etiquetaId && <p className='text-xs text-destructive'>{errors.etiquetaId}</p>}
              </div>
              <div className='grid grid-cols-2 gap-3'>
                <div className='space-y-1.5'>
                  <Label>Kg Neto envase</Label>
                  <Input type='number' step='0.001' value={kgNetoEnvase} onChange={(e) => setKgNetoEnvase(e.target.value)} />
                </div>
                <div className='space-y-1.5'>
                  <Label>Kg Bruto envase</Label>
                  <Input type='number' step='0.001' value={kgBrutoEnvase} onChange={(e) => setKgBrutoEnvase(e.target.value)} />
                </div>
              </div>
            </>
          )}

          <div className='flex items-center gap-2'>
            <Switch id='activo-articulo' checked={activo} onCheckedChange={setActivo} />
            <Label htmlFor='activo-articulo'>Activo</Label>
          </div>
        </div>

        <SheetFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)} disabled={mutation.isPending}>Cancelar</Button>
          <Button onClick={handleSubmit} isLoading={mutation.isPending}>
            <Icons.check className='mr-1 h-4 w-4' /> {isEdit ? 'Guardar cambios' : 'Crear artículo'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

export function ArticuloFormSheetTrigger() {
  const [open, setOpen] = useState(false)
  const puedeEscribir = usePuedeEscribir(ITEM)
  if (!puedeEscribir) return null
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Icons.add className='mr-2 h-4 w-4' /> Nuevo Artículo
      </Button>
      <ArticuloFormSheet open={open} onOpenChange={setOpen} />
    </>
  )
}
