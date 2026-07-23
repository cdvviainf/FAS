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
import { cuentaCorrienteService } from '../service'
import type { NaturalezaMovimientoCC } from '../types'

const conceptosCtaCteService = createMantenedorService('conceptos-cta-cte')
const monedasService = createMantenedorService('monedas')

interface MovimientoCCFormSheetProps {
  entidadId: number
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MovimientoCCFormSheet({ entidadId, open, onOpenChange }: MovimientoCCFormSheetProps) {
  const queryClient = useQueryClient()
  const [tipoId, setTipoId] = useState<number | null>(null)
  const [naturaleza, setNaturaleza] = useState<NaturalezaMovimientoCC>('HABER')
  const [fecha, setFecha] = useState('')
  const [glosa, setGlosa] = useState('')
  const [monto, setMonto] = useState('')
  const [monedaId, setMonedaId] = useState<number | null>(null)
  const [referencia, setReferencia] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const { data: tipos } = useQuery({
    queryKey: ['conceptos-cta-cte-options'],
    queryFn: () => conceptosCtaCteService.list({ soloActivos: true, limit: 500 }),
    staleTime: 60_000,
    enabled: open,
  })
  const tipoSel = tipos?.data.find((t) => t.id === tipoId) as { naturaleza?: string } | undefined

  const { data: monedas } = useQuery({
    queryKey: ['monedas-options-cc'],
    queryFn: () => monedasService.list({ soloActivos: true, limit: 500 }),
    staleTime: 60_000,
    enabled: open,
  })

  useEffect(() => {
    if (!open) return
    setErrors({})
    setTipoId(null)
    setNaturaleza('HABER')
    setFecha('')
    setGlosa('')
    setMonto('')
    setMonedaId(null)
    setReferencia('')
  }, [open])

  useEffect(() => {
    if (tipoSel?.naturaleza && tipoSel.naturaleza !== 'AMBOS') {
      setNaturaleza(tipoSel.naturaleza as NaturalezaMovimientoCC)
    }
  }, [tipoSel])

  const mutation = useMutation({
    mutationFn: () => cuentaCorrienteService.imputar(entidadId, {
      tipoId: tipoId!,
      naturaleza,
      fecha,
      glosa: glosa.trim() || null,
      monto: Number(monto),
      monedaId,
      referencia: referencia.trim() || null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cuenta-corriente', entidadId] })
      toast.success('Movimiento registrado')
      onOpenChange(false)
    },
    onError: (e: Error) => toast.error(e.message || 'Error al registrar el movimiento'),
  })

  function validar(): boolean {
    const e: Record<string, string> = {}
    if (!tipoId) e.tipoId = 'El concepto es requerido'
    if (!fecha) e.fecha = 'La fecha es requerida'
    if (!monto || Number(monto) <= 0) e.monto = 'El monto debe ser mayor a 0'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit() {
    if (!validar()) return
    mutation.mutate()
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='flex w-full flex-col sm:max-w-md'>
        <SheetHeader>
          <SheetTitle>Nuevo movimiento de cuenta corriente</SheetTitle>
          <SheetDescription>Los movimientos son inmutables; se corrigen con un reverso (R5).</SheetDescription>
        </SheetHeader>

        <div className='flex-1 space-y-4 overflow-auto px-1 py-2'>
          <div className='space-y-1.5'>
            <Label>Concepto <span className='text-destructive'>*</span></Label>
            <Select value={tipoId ? String(tipoId) : ''} onValueChange={(v) => setTipoId(parseInt(v))}>
              <SelectTrigger><SelectValue placeholder='Seleccionar concepto...' /></SelectTrigger>
              <SelectContent>
                {(tipos?.data ?? []).map((t) => (
                  <SelectItem key={t.id} value={String(t.id)}>{t.descripcion}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.tipoId && <p className='text-xs text-destructive'>{errors.tipoId}</p>}
          </div>

          <div className='space-y-1.5'>
            <Label>Naturaleza <span className='text-destructive'>*</span></Label>
            <Select value={naturaleza} onValueChange={(v) => setNaturaleza(v as NaturalezaMovimientoCC)} disabled={!!tipoSel?.naturaleza && tipoSel.naturaleza !== 'AMBOS'}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value='DEBE'>Debe</SelectItem>
                <SelectItem value='HABER'>Haber</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className='grid grid-cols-2 gap-3'>
            <div className='space-y-1.5'>
              <Label>Fecha <span className='text-destructive'>*</span></Label>
              <Input type='date' value={fecha} onChange={(e) => setFecha(e.target.value)} />
              {errors.fecha && <p className='text-xs text-destructive'>{errors.fecha}</p>}
            </div>
            <div className='space-y-1.5'>
              <Label>Monto <span className='text-destructive'>*</span></Label>
              <Input type='number' step='0.01' value={monto} onChange={(e) => setMonto(e.target.value)} />
              {errors.monto && <p className='text-xs text-destructive'>{errors.monto}</p>}
            </div>
          </div>

          <div className='space-y-1.5'>
            <Label>Moneda</Label>
            <Select value={monedaId ? String(monedaId) : 'none'} onValueChange={(v) => setMonedaId(v === 'none' ? null : parseInt(v))}>
              <SelectTrigger><SelectValue placeholder='Moneda base' /></SelectTrigger>
              <SelectContent>
                <SelectItem value='none'>Moneda base</SelectItem>
                {(monedas?.data ?? []).map((m) => (
                  <SelectItem key={m.id} value={String(m.id)}>{m.codigo}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className='space-y-1.5'>
            <Label>Glosa</Label>
            <Input value={glosa} onChange={(e) => setGlosa(e.target.value)} />
          </div>
          <div className='space-y-1.5'>
            <Label>Referencia</Label>
            <Input value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder='Ej: OC, liquidación' />
          </div>
        </div>

        <SheetFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)} disabled={mutation.isPending}>Cancelar</Button>
          <Button onClick={handleSubmit} isLoading={mutation.isPending}>
            <Icons.check className='mr-1 h-4 w-4' /> Registrar
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
