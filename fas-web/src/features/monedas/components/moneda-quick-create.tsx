'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Icons } from '@/components/icons'
import { usePuedeEscribir } from '@/hooks/use-item-acceso'
import type { MantenedorSimple } from '@/features/mantenedor-simple/types'
import { MonedaFormSheet } from './moneda-form-sheet'

interface MonedaQuickCreateProps {
  onCreated: (moneda: MantenedorSimple) => void
}

export function MonedaQuickCreate({ onCreated }: MonedaQuickCreateProps) {
  const [open, setOpen] = useState(false)
  const puedeEscribir = usePuedeEscribir('CONFIG_MANTENEDORES')

  if (!puedeEscribir) return null

  return (
    <>
      <Button
        type='button'
        variant='outline'
        size='icon'
        className='h-9 w-9 shrink-0 self-end'
        onClick={() => setOpen(true)}
        title='Crear nueva moneda'
      >
        <Icons.add className='h-4 w-4' />
      </Button>
      <MonedaFormSheet open={open} onOpenChange={setOpen} onCreated={onCreated} />
    </>
  )
}
