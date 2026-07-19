import PageContainer from '@/components/layout/page-container'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Icons } from '@/components/icons'
import { PerfilListingClient } from '@/features/perfiles/components/perfil-listing-client'

export const metadata = {
  title: 'FAS — Perfiles'
}

export default function Page() {
  return (
    <PageContainer
      pageTitle='Perfiles'
      pageDescription='Gestiona los perfiles de acceso y su matriz de permisos por ítem de menú.'
      pageHeaderAction={
        <Button asChild>
          <Link href='/dashboard/configuracion/perfiles/nuevo'>
            <Icons.add className='mr-2 h-4 w-4' />
            Nuevo Perfil
          </Link>
        </Button>
      }
    >
      <PerfilListingClient />
    </PageContainer>
  )
}
