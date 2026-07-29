'use client'

import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { prefijosCodigoService } from '@/features/prefijos-codigo/service'
import { createMantenedorService } from '@/features/mantenedor-simple/service'
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Icons } from '@/components/icons'
import { usePuedeEscribir } from '@/hooks/use-item-acceso'
import { condicionesPagoService } from '../service'
import { FECHA_REFERENCIA_LABELS, TIPO_CONDICION_PAGO_LABELS } from '../types'
import type { CondicionPago, CondicionPagoCuotaInput, FechaReferenciaPago, TipoValorCuota, TipoCondicionPago } from '../types'

const ITEM = 'CONFIG_MANTENEDORES'
const monedasService = createMantenedorService('monedas')
const unidadesService = createMantenedorService('unidades-medida')

interface CondicionPagoFormSheetProps {
  item?: CondicionPago
  open: boolean
  onOpenChange: (open: boolean) => void
}

function cuotaVacia(): CondicionPagoCuotaInput {
  return { fechaReferencia: 'FACTURA', plazoDias: 0, tipoValor: 'PORCENTAJE', porcentaje: 0, descripcion: '' }
}

// Misma regla que el backend (condiciones-pago.schema.ts): a lo sumo UNA
// cuota MONTO_UNITARIO, y debe ser la primera, como cargo ADICIONAL —
// siempre debe existir además al menos una cuota PORCENTAJE, y las cuotas
// PORCENTAJE deben sumar exactamente 100% entre sí.
function validarReglaCuotas(cuotas: CondicionPagoCuotaInput[]): string | null {
  const cuotasMontoUnitario = cuotas.filter((c) => c.tipoValor === 'MONTO_UNITARIO')
  if (cuotasMontoUnitario.length > 1) return 'Solo puede haber una cuota de monto unitario'
  if (cuotasMontoUnitario.length === 1 && cuotas[0]?.tipoValor !== 'MONTO_UNITARIO') {
    return 'El monto unitario solo puede ser la primera cuota'
  }
  const porcentuales = cuotas.filter((c) => c.tipoValor === 'PORCENTAJE')
  if (porcentuales.length === 0) return 'Debe haber al menos una cuota por porcentaje que sume 100%'
  const suma = porcentuales.reduce((acc, c) => acc + (c.porcentaje || 0), 0)
  if (Math.round(suma * 100) / 100 !== 100) {
    return `Las cuotas por porcentaje deben sumar 100% (suma actual: ${suma}%)`
  }
  return null
}

export function CondicionPagoFormSheet({ item, open, onOpenChange }: CondicionPagoFormSheetProps) {
  const isEdit = !!item
  const queryClient = useQueryClient()

  const [codigo, setCodigo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [tipo, setTipo] = useState<TipoCondicionPago | ''>('')
  const [cuotas, setCuotas] = useState<CondicionPagoCuotaInput[]>([cuotaVacia()])
  const [errors, setErrors] = useState<Record<string, string>>({})

  const { data: monedas } = useQuery({ queryKey: ['monedas-options'], queryFn: () => monedasService.list({ limit: 200 }), staleTime: 5 * 60_000, enabled: open })
  // La cuota de monto unitario solo admite Caja o Kilo (mismo criterio que
  // el backend, condiciones-pago.service.ts) — son las dos únicas opciones,
  // por eso se muestran como radio button fijo en vez de un select.
  const { data: unidades } = useQuery({ queryKey: ['unidades-medida-options'], queryFn: () => unidadesService.list({ limit: 200 }), staleTime: 5 * 60_000, enabled: open })
  const ORDEN_UNIDAD: Record<string, number> = { CAJA: 0, KG: 1 }
  const UNIDAD_LABELS: Record<string, string> = { CAJA: 'Caja', KG: 'Kilo' }
  const unidadesCajaKilo = (unidades?.data ?? [])
    .filter((u) => ['CAJA', 'KG'].includes(u.codigo))
    .sort((a, b) => ORDEN_UNIDAD[a.codigo] - ORDEN_UNIDAD[b.codigo])

  useEffect(() => {
    if (!open) return
    setErrors({})
    if (item) {
      setCodigo(item.codigo)
      setDescripcion(item.descripcion)
      setTipo(item.tipo)
      setCuotas(item.cuotas.length > 0
        ? item.cuotas.map((c) => ({
            fechaReferencia: c.fechaReferencia,
            plazoDias: c.plazoDias,
            tipoValor: c.tipoValor,
            porcentaje: c.porcentaje != null ? Number(c.porcentaje) : null,
            valorUnitario: c.valorUnitario != null ? Number(c.valorUnitario) : null,
            monedaId: c.monedaId,
            unidadId: c.unidadId,
            descripcion: c.descripcion ?? '',
          }))
        : [cuotaVacia()])
    } else {
      setCodigo('')
      setDescripcion('')
      setTipo('')
      setCuotas([cuotaVacia()])
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item?.id])

  // Sugerencia de código (Prefijos de Código) — solo al crear.
  const { data: codigoSugerido } = useQuery({
    queryKey: ['prefijo-codigo-siguiente', 'condicionPago'],
    queryFn: () => prefijosCodigoService.siguienteCodigo('condicionPago'),
    enabled: open && !isEdit,
    staleTime: 0,
  })

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open && !isEdit && codigoSugerido) setCodigo(codigoSugerido)
  }, [codigoSugerido, open, isEdit])

  const sumaCuotas = cuotas.filter((c) => c.tipoValor === 'PORCENTAJE').reduce((acc, c) => acc + (c.porcentaje || 0), 0)

  function actualizarCuota(index: number, cambios: Partial<CondicionPagoCuotaInput>) {
    setCuotas((prev) => prev.map((c, i) => (i === index ? { ...c, ...cambios } : c)))
  }
  function cambiarTipoValor(index: number, tipoValor: TipoValorCuota) {
    actualizarCuota(index, tipoValor === 'PORCENTAJE'
      ? { tipoValor, porcentaje: 0, valorUnitario: null, monedaId: null, unidadId: null }
      : { tipoValor, porcentaje: null, valorUnitario: 0, monedaId: null, unidadId: null })
  }
  function agregarCuota() {
    setCuotas((prev) => [...prev, cuotaVacia()])
  }
  function quitarCuota(index: number) {
    setCuotas((prev) => prev.filter((_, i) => i !== index))
  }

  function validar(): boolean {
    const e: Record<string, string> = {}
    if (!isEdit && !codigo.trim()) e.codigo = 'El código es requerido'
    if (!descripcion.trim()) e.descripcion = 'La descripción es requerida'
    if (!isEdit && !tipo) e.tipo = 'El tipo (Compra/Venta) es requerido'
    if (cuotas.length === 0) e.cuotas = 'Debe agregar al menos una cuota'
    const errorRegla = validarReglaCuotas(cuotas)
    if (errorRegla) e.cuotas = errorRegla
    for (const c of cuotas) {
      if (c.tipoValor === 'MONTO_UNITARIO' && (!c.monedaId || !c.unidadId || !c.valorUnitario)) {
        e.cuotas = 'La cuota de monto unitario requiere valor, moneda y unidad'
      }
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        descripcion: descripcion.trim(),
        cuotas: cuotas.map((c) => ({ ...c, descripcion: c.descripcion?.trim() || undefined })),
      }
      if (isEdit) return condicionesPagoService.update(item!.id, payload)
      return condicionesPagoService.create({ ...payload, codigo: codigo.trim(), tipo: tipo as TipoCondicionPago })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['condiciones-pago'] })
      toast.success(isEdit ? 'Condición de Pago actualizada' : 'Condición de Pago creada')
      onOpenChange(false)
    },
    onError: (e: Error) => toast.error(e.message || 'Error al guardar la Condición de Pago'),
  })

  function handleSubmit() {
    if (!validar()) return
    mutation.mutate()
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='flex w-full flex-col sm:max-w-2xl'>
        <SheetHeader>
          <SheetTitle>{isEdit ? `Editar Condición de Pago ${item?.codigo}` : 'Nueva Condición de Pago'}</SheetTitle>
          <SheetDescription>Define las cuotas que se copiarán automáticamente a la Orden de Compra / Cierre Comercial al seleccionarla.</SheetDescription>
        </SheetHeader>

        <div className='flex-1 space-y-4 overflow-auto px-1 py-2'>
          <div className='space-y-1.5'>
            <Label>Código <span className='text-destructive'>*</span></Label>
            <Input value={codigo} onChange={(e) => setCodigo(e.target.value)} disabled={isEdit} />
            {errors.codigo && <p className='text-xs text-destructive'>{errors.codigo}</p>}
          </div>
          <div className='space-y-1.5'>
            <Label>Descripción <span className='text-destructive'>*</span></Label>
            <Input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder='Ej: 50/50 a 30 y 60 días' />
            {errors.descripcion && <p className='text-xs text-destructive'>{errors.descripcion}</p>}
          </div>
          <div className='space-y-1.5'>
            <Label>Tipo <span className='text-destructive'>*</span></Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as TipoCondicionPago)} disabled={isEdit}>
              <SelectTrigger><SelectValue placeholder='Seleccionar...' /></SelectTrigger>
              <SelectContent>
                {(Object.keys(TIPO_CONDICION_PAGO_LABELS) as TipoCondicionPago[]).map((k) => (
                  <SelectItem key={k} value={k}>{TIPO_CONDICION_PAGO_LABELS[k]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.tipo && <p className='text-xs text-destructive'>{errors.tipo}</p>}
          </div>

          <div className='space-y-2'>
            <Label>Cuotas</Label>
            {cuotas.map((c, i) => (
              <div key={i} className='space-y-2 rounded-md border p-3'>
                <div className='flex items-center justify-between'>
                  <span className='text-xs font-medium text-muted-foreground'>Cuota {i + 1}</span>
                  <Button type='button' variant='ghost' size='icon' className='h-7 w-7' onClick={() => quitarCuota(i)} disabled={cuotas.length <= 1}>
                    <Icons.trash className='h-3.5 w-3.5' />
                  </Button>
                </div>

                <div className='grid grid-cols-2 gap-2'>
                  <div className='space-y-1.5'>
                    <Label className='text-xs'>Fecha de Referencia</Label>
                    <Select value={c.fechaReferencia} onValueChange={(v) => actualizarCuota(i, { fechaReferencia: v as FechaReferenciaPago })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(FECHA_REFERENCIA_LABELS) as FechaReferenciaPago[]).map((k) => (
                          <SelectItem key={k} value={k}>{FECHA_REFERENCIA_LABELS[k]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className='space-y-1.5'>
                    <Label className='text-xs'>Plazo (días)</Label>
                    <Input type='number' value={c.plazoDias || ''} onChange={(e) => actualizarCuota(i, { plazoDias: Number(e.target.value) })} />
                  </div>
                </div>

                {i === 0 && (
                  <div className='space-y-1.5'>
                    <Label className='text-xs'>Tipo de valor</Label>
                    <Select value={c.tipoValor} onValueChange={(v) => cambiarTipoValor(i, v as TipoValorCuota)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value='PORCENTAJE'>Porcentaje</SelectItem>
                        <SelectItem value='MONTO_UNITARIO'>Monto unitario (por Caja/Kilo)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {c.tipoValor === 'PORCENTAJE' ? (
                  <div className='space-y-1.5'>
                    <Label className='text-xs'>Porcentaje</Label>
                    <Input type='number' value={c.porcentaje ?? ''} onChange={(e) => actualizarCuota(i, { porcentaje: Number(e.target.value) })} />
                  </div>
                ) : (
                  <div className='grid grid-cols-3 gap-2'>
                    <div className='space-y-1.5'>
                      <Label className='text-xs'>Valor por unidad</Label>
                      <Input type='number' step='0.01' value={c.valorUnitario ?? ''} onChange={(e) => actualizarCuota(i, { valorUnitario: Number(e.target.value) })} />
                    </div>
                    <div className='space-y-1.5'>
                      <Label className='text-xs'>Moneda</Label>
                      <Select value={c.monedaId ? String(c.monedaId) : ''} onValueChange={(v) => actualizarCuota(i, { monedaId: Number(v) })}>
                        <SelectTrigger><SelectValue placeholder='Moneda...' /></SelectTrigger>
                        <SelectContent>
                          {(monedas?.data ?? []).map((m) => (
                            <SelectItem key={m.id} value={String(m.id)}>{m.codigo}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className='space-y-1.5'>
                      <Label className='text-xs'>Unidad</Label>
                      <RadioGroup
                        className='grid-flow-col justify-start gap-4 pt-1.5'
                        value={c.unidadId ? String(c.unidadId) : ''}
                        onValueChange={(v) => actualizarCuota(i, { unidadId: Number(v) })}
                      >
                        {unidadesCajaKilo.map((u) => (
                          <div key={u.id} className='flex items-center gap-1.5'>
                            <RadioGroupItem value={String(u.id)} id={`unidad-${i}-${u.id}`} />
                            <Label htmlFor={`unidad-${i}-${u.id}`} className='text-xs font-normal'>{UNIDAD_LABELS[u.codigo]}</Label>
                          </div>
                        ))}
                      </RadioGroup>
                    </div>
                  </div>
                )}

                <div className='space-y-1.5'>
                  <Label className='text-xs'>Descripción</Label>
                  <Input value={c.descripcion ?? ''} onChange={(e) => actualizarCuota(i, { descripcion: e.target.value })} placeholder='Ej: Anticipo' />
                </div>
              </div>
            ))}
            <p className='text-xs text-muted-foreground'>Suma de cuotas por porcentaje: {sumaCuotas}%</p>
            {errors.cuotas && <p className='text-xs text-destructive'>{errors.cuotas}</p>}
            <Button type='button' variant='secondary' size='sm' onClick={agregarCuota}>
              <Icons.add className='mr-1 h-4 w-4' /> Agregar cuota
            </Button>
          </div>
        </div>

        <SheetFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)} disabled={mutation.isPending}>Cancelar</Button>
          <Button onClick={handleSubmit} isLoading={mutation.isPending}>
            <Icons.check className='mr-1 h-4 w-4' /> {isEdit ? 'Guardar cambios' : 'Crear Condición de Pago'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

export function CondicionPagoFormSheetTrigger() {
  const [open, setOpen] = useState(false)
  const puedeEscribir = usePuedeEscribir(ITEM)
  if (!puedeEscribir) return null
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Icons.add className='mr-2 h-4 w-4' /> Nueva Condición de Pago
      </Button>
      <CondicionPagoFormSheet open={open} onOpenChange={setOpen} />
    </>
  )
}
