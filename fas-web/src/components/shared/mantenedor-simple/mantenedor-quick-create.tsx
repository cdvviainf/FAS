'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Icons } from '@/components/icons'
import { usePuedeEscribir } from '@/hooks/use-item-acceso'
import type { MantenedorSimple } from '@/features/mantenedor-simple/types'
import { MantenedorFormSheet } from './mantenedor-form-sheet'

interface MantenedorQuickCreateProps {
  recurso: string
  titulo: string
  onCreated: (item: MantenedorSimple) => void
}

/** Botón "+" que crea un registro del mantenedor genérico (codigo/descripcion)
 * sin salir del formulario que lo referencia — mismo patrón que
 * EspecieQuickCreate y afines, pero parametrizado por `recurso` para
 * mantenedores sin feature module propio (ej. Forma de Pago). */
export function MantenedorQuickCreate({ recurso, titulo, onCreated }: MantenedorQuickCreateProps) {
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
        title={`Crear nuevo ${titulo.toLowerCase()}`}
      >
        <Icons.add className='h-4 w-4' />
      </Button>
      <MantenedorFormSheet recurso={recurso} titulo={titulo} open={open} onOpenChange={setOpen} onCreated={onCreated} />
    </>
  )
}
