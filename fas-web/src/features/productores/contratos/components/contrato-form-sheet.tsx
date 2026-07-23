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
import { Textarea } from '@/components/ui/textarea'
import { Icons } from '@/components/icons'
import { createMantenedorService } from '@/features/mantenedor-simple/service'
import { contratosService } from '../service'
import type { Contrato, UnidadVolumen } from '../types'

const temporadasService = createMantenedorService('temporadas')

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
  const [fechaInicio, setFechaInicio] = useState('')
  const [fechaTermino, setFechaTermino] = useState('')
  const [valoresFacturacion, setValoresFacturacion] = useState('')
  const [condicionesPago, setCondicionesPago] = useState('')
  const [condicionesFacturacion, setCondicionesFacturacion] = useState('')
  const [volumenComprometido, setVolumenComprometido] = useState('')
  const [unidadVolumen, setUnidadVolumen] = useState<UnidadVolumen | 'none'>('none')
  const [minimoGarantizado, setMinimoGarantizado] = useState('')

  const { data: temporadas } = useQuery({
    queryKey: ['temporadas-options-contrato'],
    queryFn: () => temporadasService.list({ limit: 500 }),
    staleTime: 60_000,
    enabled: open,
  })

  useEffect(() => {
    if (!open) return
    if (item) {
      setTemporadaId(item.temporadaId)
      setFechaInicio(item.fechaInicio?.slice(0, 10) ?? '')
      setFechaTermino(item.fechaTermino?.slice(0, 10) ?? '')
      setValoresFacturacion(item.valoresFacturacion ?? '')
      setCondicionesPago(item.condicionesPago ?? '')
      setCondicionesFacturacion(item.condicionesFacturacion ?? '')
      setVolumenComprometido(item.volumenComprometido ?? '')
      setUnidadVolumen(item.unidadVolumen ?? 'none')
      setMinimoGarantizado(item.minimoGarantizado ?? '')
    } else {
      setTemporadaId(null)
      setFechaInicio('')
      setFechaTermino('')
      setValoresFacturacion('')
      setCondicionesPago('')
      setCondicionesFacturacion('')
      setVolumenComprometido('')
      setUnidadVolumen('none')
      setMinimoGarantizado('')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item?.id])

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        temporadaId,
        fechaInicio: fechaInicio || null,
        fechaTermino: fechaTermino || null,
        valoresFacturacion: valoresFacturacion.trim() || null,
        condicionesPago: condicionesPago.trim() || null,
        condicionesFacturacion: condicionesFacturacion.trim() || null,
        volumenComprometido: volumenComprometido ? Number(volumenComprometido) : null,
        unidadVolumen: unidadVolumen === 'none' ? null : unidadVolumen,
        minimoGarantizado: minimoGarantizado ? Number(minimoGarantizado) : null,
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='flex w-full flex-col sm:max-w-lg'>
        <SheetHeader>
          <SheetTitle>{isEdit ? 'Editar contrato' : 'Nuevo contrato'}</SheetTitle>
          <SheetDescription>Requiere que el productor tenga un representante legal registrado (R3).</SheetDescription>
        </SheetHeader>

        <div className='flex-1 space-y-4 overflow-auto px-1 py-2'>
          <div className='space-y-1.5'>
            <Label>Temporada</Label>
            <Select value={temporadaId ? String(temporadaId) : 'none'} onValueChange={(v) => setTemporadaId(v === 'none' ? null : parseInt(v))}>
              <SelectTrigger><SelectValue placeholder='Sin temporada' /></SelectTrigger>
              <SelectContent>
                <SelectItem value='none'>Sin temporada</SelectItem>
                {(temporadas?.data ?? []).map((t) => (
                  <SelectItem key={t.id} value={String(t.id)}>{t.codigo} — {t.descripcion}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className='grid grid-cols-2 gap-3'>
            <div className='space-y-1.5'>
              <Label>Fecha inicio</Label>
              <Input type='date' value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
            </div>
            <div className='space-y-1.5'>
              <Label>Fecha término</Label>
              <Input type='date' value={fechaTermino} onChange={(e) => setFechaTermino(e.target.value)} />
            </div>
          </div>

          <div className='grid grid-cols-2 gap-3'>
            <div className='space-y-1.5'>
              <Label>Volumen comprometido</Label>
              <Input type='number' step='0.001' value={volumenComprometido} onChange={(e) => setVolumenComprometido(e.target.value)} />
            </div>
            <div className='space-y-1.5'>
              <Label>Unidad</Label>
              <Select value={unidadVolumen} onValueChange={(v) => setUnidadVolumen(v as UnidadVolumen | 'none')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value='none'>—</SelectItem>
                  <SelectItem value='KG'>Kilos</SelectItem>
                  <SelectItem value='CAJAS'>Cajas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className='space-y-1.5'>
            <Label>Mínimo garantizado</Label>
            <Input type='number' step='0.01' value={minimoGarantizado} onChange={(e) => setMinimoGarantizado(e.target.value)} />
          </div>

          <div className='space-y-1.5'>
            <Label>Valores de facturación</Label>
            <Textarea rows={3} value={valoresFacturacion} onChange={(e) => setValoresFacturacion(e.target.value)} />
          </div>
          <div className='space-y-1.5'>
            <Label>Condiciones de pago</Label>
            <Textarea rows={3} value={condicionesPago} onChange={(e) => setCondicionesPago(e.target.value)} />
          </div>
          <div className='space-y-1.5'>
            <Label>Condiciones de facturación</Label>
            <Textarea rows={3} value={condicionesFacturacion} onChange={(e) => setCondicionesFacturacion(e.target.value)} />
          </div>
        </div>

        <SheetFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)} disabled={mutation.isPending}>Cancelar</Button>
          <Button onClick={() => mutation.mutate()} isLoading={mutation.isPending}>
            <Icons.check className='mr-1 h-4 w-4' /> {isEdit ? 'Guardar cambios' : 'Crear contrato'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
