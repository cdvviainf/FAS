'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Icons } from '@/components/icons'
import { usePuedeEscribir } from '@/hooks/use-item-acceso'

// Botón "Nuevo Perfil" gateado por permiso: solo visible con nivel TOTAL en el
// ítem CONFIG_PERFILES. Con LECTURA/SIN_ACCESO no se renderiza.
export function NuevoPerfilButton() {
  const puedeEscribir = usePuedeEscribir('CONFIG_PERFILES')
  if (!puedeEscribir) return null

  return (
    <Button asChild>
      <Link href='/dashboard/configuracion/perfiles/nuevo'>
        <Icons.add className='mr-2 h-4 w-4' />
        Nuevo Perfil
      </Link>
    </Button>
  )
}
