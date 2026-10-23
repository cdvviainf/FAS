'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Icons } from '@/components/icons'

// Un par de calidad permitida = (NotaCalidad, NotaCondicion). Las "calidades
// admitidas" son combinaciones específicas (ej. A1/A2/B1), no el producto
// cartesiano de dos listas independientes.
export interface CalidadPermitidaPar {
  notaCalidadId: number
  notaCondicionId: number
}

interface NotaRef {
  id: number
  descripcion: string
}

// Componente reutilizable (Cierre Comercial, Solicitud de Inspección, Instructivo
// de Embalaje): dos selects (Calidad, Condición) + "Agregar" → lista de chips.
export function CalidadesPermitidasInput({
  value,
  onChange,
  calidades,
  condiciones,
  disabled = false,
  label = 'Calidades permitidas',
}: {
  value: CalidadPermitidaPar[]
  onChange: (pares: CalidadPermitidaPar[]) => void
  calidades: NotaRef[]
  condiciones: NotaRef[]
  disabled?: boolean
  label?: string
}) {
  const [calidadId, setCalidadId] = useState<string>('')
  const [condicionId, setCondicionId] = useState<string>('')

  const descCalidad = (id: number) => calidades.find((c) => c.id === id)?.descripcion ?? String(id)
  const descCondicion = (id: number) => condiciones.find((c) => c.id === id)?.descripcion ?? String(id)

  function agregar() {
    if (!calidadId || !condicionId) return
    const nc = Number(calidadId)
    const nco = Number(condicionId)
    if (value.some((p) => p.notaCalidadId === nc && p.notaCondicionId === nco)) return // ya está
    onChange([...value, { notaCalidadId: nc, notaCondicionId: nco }])
    setCalidadId('')
    setCondicionId('')
  }

  function quitar(nc: number, nco: number) {
    onChange(value.filter((p) => !(p.notaCalidadId === nc && p.notaCondicionId === nco)))
  }

  return (
    <div className='space-y-2'>
      <Label>{label}</Label>
      <div className='flex flex-wrap items-end gap-2'>
        <div className='min-w-[9rem] flex-1 space-y-1'>
          <span className='text-muted-foreground text-xs'>Calidad</span>
          <Select value={calidadId} onValueChange={setCalidadId} disabled={disabled}>
            <SelectTrigger><SelectValue placeholder='Calidad...' /></SelectTrigger>
            <SelectContent>
              {calidades.map((c) => (<SelectItem key={c.id} value={String(c.id)}>{c.descripcion}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
        <div className='min-w-[9rem] flex-1 space-y-1'>
          <span className='text-muted-foreground text-xs'>Condición</span>
          <Select value={condicionId} onValueChange={setCondicionId} disabled={disabled}>
            <SelectTrigger><SelectValue placeholder='Condición...' /></SelectTrigger>
            <SelectContent>
              {condiciones.map((c) => (<SelectItem key={c.id} value={String(c.id)}>{c.descripcion}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
        <Button type='button' variant='secondary' onClick={agregar} disabled={disabled || !calidadId || !condicionId}>
          <Icons.add className='mr-1 h-4 w-4' /> Agregar
        </Button>
      </div>
      {value.length > 0 ? (
        <div className='flex flex-wrap gap-1'>
          {value.map((p) => (
            <Badge key={`${p.notaCalidadId}-${p.notaCondicionId}`} variant='outline' className='gap-1'>
              {descCalidad(p.notaCalidadId)}/{descCondicion(p.notaCondicionId)}
              {!disabled && (
                <button type='button' onClick={() => quitar(p.notaCalidadId, p.notaCondicionId)} className='text-muted-foreground hover:text-destructive'>
                  <Icons.close className='h-3 w-3' />
                </button>
              )}
            </Badge>
          ))}
        </div>
      ) : (
        <p className='text-muted-foreground text-xs'>Sin restricción: se admite cualquier combinación de calidad/condición.</p>
      )}
    </div>
  )
}
