'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Icons } from '@/components/icons'
import { usePuedeEscribir } from '@/hooks/use-item-acceso'

// Botón "Nuevo Usuario" gateado por permiso: solo visible con nivel TOTAL en el
// ítem CONFIG_USUARIOS. Con LECTURA/SIN_ACCESO no se renderiza.
export function NuevoUsuarioButton() {
  const puedeEscribir = usePuedeEscribir('CONFIG_USUARIOS')
  if (!puedeEscribir) return null

  return (
    <Button asChild>
      <Link href='/dashboard/configuracion/usuarios/nuevo'>
        <Icons.add className='mr-2 h-4 w-4' />
        Nuevo Usuario
      </Link>
    </Button>
  )
}
