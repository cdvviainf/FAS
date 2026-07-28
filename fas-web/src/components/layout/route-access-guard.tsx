'use client'

import { usePathname } from 'next/navigation'
import { useMenuAcceso, resolverNivelPorRuta } from '@/contexts/menu-acceso-context'
import { Icons } from '@/components/icons'

// Bloquea el render de una página cuando el ItemMenu más específico que
// cubre la ruta actual resuelve a SIN_ACCESO. Sin match (catálogo ItemMenu
// incompleto) se permite el acceso — mismo comportamiento por defecto que
// el filtro de sidebar/buscador en use-nav.ts.
export function RouteAccessGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { items, isLoading } = useMenuAcceso()

  if (isLoading) return <>{children}</>

  const nivel = resolverNivelPorRuta(pathname, items)
  if (nivel === 'SIN_ACCESO') {
    return (
      <div className='flex flex-1 flex-col items-center justify-center gap-2 p-10 text-center'>
        <Icons.warning className='text-muted-foreground h-10 w-10' />
        <h2 className='text-lg font-semibold'>Sin acceso</h2>
        <p className='text-muted-foreground max-w-sm text-sm'>
          Tu perfil no tiene permiso para ver esta sección. Si crees que es un error, contacta a un administrador.
        </p>
      </div>
    )
  }

  return <>{children}</>
}
