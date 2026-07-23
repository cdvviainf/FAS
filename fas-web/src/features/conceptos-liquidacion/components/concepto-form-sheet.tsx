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
import { createMantenedorService } from '@/features/mantenedor-simple/service'
import { usePuedeEscribir } from '@/hooks/use-item-acceso'
import { conceptosLiquidacionService } from '../service'
import { FORMA_APLICACION_LABELS, NATURALEZA_CONCEPTO_LABELS } from '../types'
import type { ConceptoLiquidacion, FormaAplicacionConcepto, NaturalezaConcepto, ValorEspecieInput } from '../types'

const especiesService = createMantenedorService('especies')
const ITEM = 'config.conceptos-liquidacion'

interface ConceptoFormSheetProps {
  item?: ConceptoLiquidacion
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ConceptoFormSheet({ item, open, onOpenChange }: ConceptoFormSheetProps) {
  const isEdit = !!item
  const queryClient = useQueryClient()

  const [codigo, setCodigo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [formaAplicacion, setFormaAplicacion] = useState<FormaAplicacionConcepto>('POR_KILO')
  const [naturaleza, setNaturaleza] = useState<NaturalezaConcepto>('COBRO')
  const [valores, setValores] = useState<ValorEspecieInput[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})

  const { data: especies } = useQuery({
    queryKey: ['especies-options-concepto'],
    queryFn: () => especiesService.list({ soloActivos: true, limit: 500 }),
    staleTime: 60_000,
    enabled: open,
  })

  useEffect(() => {
    if (!open) return
    setErrors({})
    if (item) {
      setCodigo(item.codigo)
      setDescripcion(item.descripcion)
      setFormaAplicacion(item.formaAplicacion)
      setNaturaleza(item.naturaleza)
      setValores(item.valores.map((v) => ({ especieId: v.especieId, valor: Number(v.valor) })))
    } else {
      setCodigo('')
      setDescripcion('')
      setFormaAplicacion('POR_KILO')
      setNaturaleza('COBRO')
      setValores([])
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item?.id])

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = { descripcion: descripcion.trim(), formaAplicacion, naturaleza, valores }
      if (isEdit) return conceptosLiquidacionService.update(item!.id, payload)
      return conceptosLiquidacionService.create({ ...payload, codigo: codigo.trim() })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conceptos-liquidacion'] })
      toast.success(isEdit ? 'Concepto actualizado' : 'Concepto creado')
      onOpenChange(false)
    },
    onError: (e: Error) => toast.error(e.message || 'Error al guardar el concepto'),
  })

  function agregarEspecie(especieId: string) {
    const id = parseInt(especieId)
    if (valores.some((v) => v.especieId === id)) return
    setValores((prev) => [...prev, { especieId: id, valor: 0 }])
  }
  function actualizarValor(especieId: number, valor: number) {
    setValores((prev) => prev.map((v) => v.especieId === especieId ? { ...v, valor } : v))
  }
  function quitarEspecie(especieId: number) {
    setValores((prev) => prev.filter((v) => v.especieId !== especieId))
  }
  function nombreEspecie(id: number) {
    return especies?.data.find((e) => e.id === id)?.descripcion ?? String(id)
  }

  function validar(): boolean {
    const e: Record<string, string> = {}
    if (!isEdit && !codigo.trim()) e.codigo = 'El código es requerido'
    if (!descripcion.trim()) e.descripcion = 'La descripción es requerida'
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
          <SheetTitle>{isEdit ? `Editar concepto ${item?.codigo}` : 'Nuevo concepto de liquidación'}</SheetTitle>
          <SheetDescription>Matriz de valores por especie, estilo lista de precios.</SheetDescription>
        </SheetHeader>

        <div className='flex-1 space-y-4 overflow-auto px-1 py-2'>
          <div className='grid grid-cols-2 gap-3'>
            <div className='space-y-1.5'>
              <Label>Código <span className='text-destructive'>*</span></Label>
              <Input value={codigo} onChange={(e) => setCodigo(e.target.value)} disabled={isEdit} />
              {errors.codigo && <p className='text-xs text-destructive'>{errors.codigo}</p>}
            </div>
            <div className='space-y-1.5'>
              <Label>Naturaleza <span className='text-destructive'>*</span></Label>
              <Select value={naturaleza} onValueChange={(v) => setNaturaleza(v as NaturalezaConcepto)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(NATURALEZA_CONCEPTO_LABELS) as NaturalezaConcepto[]).map((n) => (
                    <SelectItem key={n} value={n}>{NATURALEZA_CONCEPTO_LABELS[n]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className='space-y-1.5'>
            <Label>Descripción <span className='text-destructive'>*</span></Label>
            <Input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
            {errors.descripcion && <p className='text-xs text-destructive'>{errors.descripcion}</p>}
          </div>

          <div className='space-y-1.5'>
            <Label>Forma de aplicación <span className='text-destructive'>*</span></Label>
            <Select value={formaAplicacion} onValueChange={(v) => setFormaAplicacion(v as FormaAplicacionConcepto)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(FORMA_APLICACION_LABELS) as FormaAplicacionConcepto[]).map((f) => (
                  <SelectItem key={f} value={f}>{FORMA_APLICACION_LABELS[f]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className='space-y-2'>
            <Label>Valores por especie</Label>
            <Select value='' onValueChange={agregarEspecie}>
              <SelectTrigger><SelectValue placeholder='Agregar especie...' /></SelectTrigger>
              <SelectContent>
                {(especies?.data ?? []).map((e) => (
                  <SelectItem key={e.id} value={String(e.id)}>{e.descripcion}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {valores.length > 0 && (
              <div className='space-y-2 rounded-md border p-2'>
                {valores.map((v) => (
                  <div key={v.especieId} className='flex items-center gap-2'>
                    <span className='flex-1 text-sm'>{nombreEspecie(v.especieId)}</span>
                    <Input
                      type='number' step='0.0001' className='w-32'
                      value={v.valor} onChange={(e) => actualizarValor(v.especieId, Number(e.target.value))}
                    />
                    <Button type='button' variant='ghost' size='icon' className='h-8 w-8' onClick={() => quitarEspecie(v.especieId)}>
                      <Icons.trash className='h-4 w-4' />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <SheetFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)} disabled={mutation.isPending}>Cancelar</Button>
          <Button onClick={handleSubmit} isLoading={mutation.isPending}>
            <Icons.check className='mr-1 h-4 w-4' /> {isEdit ? 'Guardar cambios' : 'Crear concepto'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

export function ConceptoFormSheetTrigger() {
  const [open, setOpen] = useState(false)
  const puedeEscribir = usePuedeEscribir(ITEM)
  if (!puedeEscribir) return null
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Icons.add className='mr-2 h-4 w-4' /> Nuevo Concepto
      </Button>
      <ConceptoFormSheet open={open} onOpenChange={setOpen} />
    </>
  )
}
