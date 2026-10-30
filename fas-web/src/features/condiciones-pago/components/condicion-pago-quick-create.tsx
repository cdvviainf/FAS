'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Icons } from '@/components/icons'
import { usePuedeEscribir } from '@/hooks/use-item-acceso'
import { CondicionPagoFormSheet } from './condicion-pago-form-sheet'
import type { CondicionPago, TipoCondicionPago } from '../types'

interface CondicionPagoQuickCreateProps {
  onCreated: (item: CondicionPago) => void
  // Tipo por defecto al crear (ej. 'COMPRA' desde la Orden de Compra) para que
  // la nueva condición aparezca en el listado filtrado del formulario.
  defaultTipo?: TipoCondicionPago
}

export function CondicionPagoQuickCreate({ onCreated, defaultTipo }: CondicionPagoQuickCreateProps) {
  const [open, setOpen] = useState(false)
  const puedeEscribir = usePuedeEscribir('CONFIG_CONDICIONES_PAGO')

  if (!puedeEscribir) return null

  return (
    <>
      <Button
        type='button'
        variant='outline'
        size='icon'
        className='h-9 w-9 shrink-0 self-end'
        onClick={() => setOpen(true)}
        title='Crear nueva Condición de Pago'
      >
        <Icons.add className='h-4 w-4' />
      </Button>
      <CondicionPagoFormSheet open={open} onOpenChange={setOpen} onCreated={onCreated} defaultTipo={defaultTipo} />
    </>
  )
}
