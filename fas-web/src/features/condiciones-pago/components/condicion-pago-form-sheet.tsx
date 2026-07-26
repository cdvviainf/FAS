'use client'

import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Icons } from '@/components/icons'
import { usePuedeEscribir } from '@/hooks/use-item-acceso'
import { condicionesPagoService } from '../service'
import type { CondicionPago, CondicionPagoCuotaInput } from '../types'

const ITEM = 'CONFIG_MANTENEDORES'

interface CondicionPagoFormSheetProps {
  item?: CondicionPago
  open: boolean
  onOpenChange: (open: boolean) => void
}

function cuotaVacia(): CondicionPagoCuotaInput {
  return { porcentaje: 0, plazoDias: 0, descripcion: '' }
}

export function CondicionPagoFormSheet({ item, open, onOpenChange }: CondicionPagoFormSheetProps) {
  const isEdit = !!item
  const queryClient = useQueryClient()

  const [codigo, setCodigo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [cuotas, setCuotas] = useState<CondicionPagoCuotaInput[]>([cuotaVacia()])
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open) return
    setErrors({})
    if (item) {
      setCodigo(item.codigo)
      setDescripcion(item.descripcion)
      setCuotas(item.cuotas.length > 0
        ? item.cuotas.map((c) => ({ porcentaje: Number(c.porcentaje), plazoDias: c.plazoDias, descripcion: c.descripcion ?? '' }))
        : [cuotaVacia()])
    } else {
      setCodigo('')
      setDescripcion('')
      setCuotas([cuotaVacia()])
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item?.id])

  const sumaCuotas = cuotas.reduce((acc, c) => acc + (c.porcentaje || 0), 0)

  function actualizarCuota(index: number, cambios: Partial<CondicionPagoCuotaInput>) {
    setCuotas((prev) => prev.map((c, i) => (i === index ? { ...c, ...cambios } : c)))
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
    if (cuotas.length === 0) e.cuotas = 'Debe agregar al menos una cuota'
    if (Math.round(sumaCuotas * 100) / 100 !== 100) {
      e.cuotas = `Las cuotas deben sumar 100% (suma actual: ${sumaCuotas}%)`
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
      return condicionesPagoService.create({ ...payload, codigo: codigo.trim() })
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
      <SheetContent className='flex w-full flex-col sm:max-w-lg'>
        <SheetHeader>
          <SheetTitle>{isEdit ? `Editar Condición de Pago ${item?.codigo}` : 'Nueva Condición de Pago'}</SheetTitle>
          <SheetDescription>Define las cuotas (% y plazo en días) que se copiarán automáticamente a la Orden de Compra al seleccionarla.</SheetDescription>
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

          <div className='space-y-2'>
            <Label>Cuotas</Label>
            {cuotas.map((c, i) => (
              <div key={i} className='flex items-end gap-2'>
                <div className='space-y-1.5'>
                  <Label className='text-xs'>Porcentaje</Label>
                  <Input type='number' className='w-24' value={c.porcentaje || ''} onChange={(e) => actualizarCuota(i, { porcentaje: Number(e.target.value) })} />
                </div>
                <div className='space-y-1.5'>
                  <Label className='text-xs'>Plazo (días)</Label>
                  <Input type='number' className='w-24' value={c.plazoDias || ''} onChange={(e) => actualizarCuota(i, { plazoDias: Number(e.target.value) })} />
                </div>
                <div className='flex-1 space-y-1.5'>
                  <Label className='text-xs'>Descripción</Label>
                  <Input value={c.descripcion ?? ''} onChange={(e) => actualizarCuota(i, { descripcion: e.target.value })} placeholder='Ej: Anticipo' />
                </div>
                <Button type='button' variant='ghost' size='icon' onClick={() => quitarCuota(i)} disabled={cuotas.length <= 1}>
                  <Icons.trash className='h-4 w-4' />
                </Button>
              </div>
            ))}
            <p className='text-xs text-muted-foreground'>Suma actual: {sumaCuotas}%</p>
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
