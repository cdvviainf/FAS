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
import { Icons } from '@/components/icons'
import { articulosService } from '../../articulos/service'
import { recetasService } from '../service'
import type { Receta, RecetaDetalleInput } from '../types'

interface RecetaFormSheetProps {
  embalajeId: number
  item?: Receta
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}

export function RecetaFormSheet({ embalajeId, item, open, onOpenChange, onSaved }: RecetaFormSheetProps) {
  const isEdit = !!item
  const queryClient = useQueryClient()

  const [codigo, setCodigo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [cantidadAProducir, setCantidadAProducir] = useState('')
  const [detalle, setDetalle] = useState<RecetaDetalleInput[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})

  const { data: componentes } = useQuery({
    queryKey: ['articulos-componentes-options'],
    queryFn: () => articulosService.list({ limit: 500, activo: true }),
    staleTime: 60_000,
    enabled: open,
  })
  const opcionesComponente = (componentes?.data ?? []).filter(
    (a) => a.tipo === 'MATERIAL_EMBALAJE' || a.tipo === 'SERVICIO',
  )

  useEffect(() => {
    if (!open) return
    setErrors({})
    if (item) {
      setCodigo(item.codigo)
      setDescripcion(item.descripcion)
      setCantidadAProducir(item.cantidadAProducir)
      setDetalle(item.detalle.map((d) => ({ componenteId: d.componenteId, cantidadAConsumir: Number(d.cantidadAConsumir) })))
    } else {
      setCodigo('')
      setDescripcion('')
      setCantidadAProducir('')
      setDetalle([])
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item?.id])

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        descripcion: descripcion.trim(),
        cantidadAProducir: Number(cantidadAProducir),
        detalle,
      }
      if (isEdit) return recetasService.update(item!.id, payload)
      return recetasService.create({ ...payload, embalajeId, codigo: codigo.trim() })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recetas-de-embalaje', embalajeId] })
      toast.success(isEdit ? 'Receta actualizada' : 'Receta creada')
      onSaved()
      onOpenChange(false)
    },
    onError: (e: Error) => toast.error(e.message || 'Error al guardar la receta'),
  })

  function agregarComponente(componenteId: string) {
    const id = parseInt(componenteId)
    if (detalle.some((d) => d.componenteId === id)) return
    setDetalle((prev) => [...prev, { componenteId: id, cantidadAConsumir: 1 }])
  }
  function cambiarCantidad(componenteId: number, cantidad: number) {
    setDetalle((prev) => prev.map((d) => (d.componenteId === componenteId ? { ...d, cantidadAConsumir: cantidad } : d)))
  }
  function quitarComponente(componenteId: number) {
    setDetalle((prev) => prev.filter((d) => d.componenteId !== componenteId))
  }
  function nombreComponente(id: number) {
    return opcionesComponente.find((c) => c.id === id)?.descripcion ?? String(id)
  }

  function validar(): boolean {
    const e: Record<string, string> = {}
    if (!isEdit && !codigo.trim()) e.codigo = 'El código es requerido'
    if (!descripcion.trim()) e.descripcion = 'La descripción es requerida'
    if (!cantidadAProducir || Number(cantidadAProducir) <= 0) e.cantidadAProducir = 'Debe ser mayor a 0'
    if (detalle.length === 0) e.detalle = 'Debe agregar al menos un componente'
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
          <SheetTitle>{isEdit ? `Editar receta ${item?.codigo}` : 'Nueva receta'}</SheetTitle>
          <SheetDescription>Componentes (Material de Embalaje o Servicio) que consume este embalaje.</SheetDescription>
        </SheetHeader>

        <div className='flex-1 space-y-4 overflow-auto px-1 py-2'>
          <div className='grid grid-cols-2 gap-3'>
            <div className='space-y-1.5'>
              <Label>Código <span className='text-destructive'>*</span></Label>
              <Input value={codigo} onChange={(e) => setCodigo(e.target.value)} disabled={isEdit} />
              {errors.codigo && <p className='text-xs text-destructive'>{errors.codigo}</p>}
            </div>
            <div className='space-y-1.5'>
              <Label>Cantidad a producir <span className='text-destructive'>*</span></Label>
              <Input type='number' step='0.001' value={cantidadAProducir} onChange={(e) => setCantidadAProducir(e.target.value)} />
              {errors.cantidadAProducir && <p className='text-xs text-destructive'>{errors.cantidadAProducir}</p>}
            </div>
          </div>

          <div className='space-y-1.5'>
            <Label>Descripción <span className='text-destructive'>*</span></Label>
            <Input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
            {errors.descripcion && <p className='text-xs text-destructive'>{errors.descripcion}</p>}
          </div>

          <div className='space-y-2'>
            <Label>Componentes <span className='text-destructive'>*</span></Label>
            <Select value='' onValueChange={agregarComponente}>
              <SelectTrigger><SelectValue placeholder='Agregar componente...' /></SelectTrigger>
              <SelectContent>
                {opcionesComponente.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.codigo} — {c.descripcion}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {detalle.length > 0 && (
              <div className='space-y-2 rounded-md border p-2'>
                {detalle.map((d) => (
                  <div key={d.componenteId} className='flex items-center gap-2'>
                    <span className='flex-1 text-sm'>{nombreComponente(d.componenteId)}</span>
                    <Input
                      type='number'
                      step='0.0001'
                      className='w-28'
                      value={d.cantidadAConsumir}
                      onChange={(e) => cambiarCantidad(d.componenteId, Number(e.target.value))}
                    />
                    <Button type='button' variant='ghost' size='icon' className='h-8 w-8' onClick={() => quitarComponente(d.componenteId)}>
                      <Icons.trash className='h-4 w-4' />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            {errors.detalle && <p className='text-xs text-destructive'>{errors.detalle}</p>}
          </div>
        </div>

        <SheetFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)} disabled={mutation.isPending}>Cancelar</Button>
          <Button onClick={handleSubmit} isLoading={mutation.isPending}>
            <Icons.check className='mr-1 h-4 w-4' /> {isEdit ? 'Guardar cambios' : 'Crear receta'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
