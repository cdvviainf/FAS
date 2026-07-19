import PageContainer from '@/components/layout/page-container'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Icons } from '@/components/icons'
import { UsuarioListingClient } from '@/features/usuarios/components/usuario-listing-client'

export const metadata = {
  title: 'FAS — Usuarios'
}

export default function Page() {
  return (
    <PageContainer
      pageTitle='Usuarios'
      pageDescription='Gestiona los usuarios del sistema y su perfil de acceso.'
      pageHeaderAction={
        <Button asChild>
          <Link href='/dashboard/configuracion/usuarios/nuevo'>
            <Icons.add className='mr-2 h-4 w-4' />
            Nuevo Usuario
          </Link>
        </Button>
      }
    >
      <UsuarioListingClient />
    </PageContainer>
  )
}
