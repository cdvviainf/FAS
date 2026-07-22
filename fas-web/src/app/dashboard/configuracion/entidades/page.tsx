import PageContainer from '@/components/layout/page-container'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Icons } from '@/components/icons'
import { EntidadListingClient } from '@/features/entidades/components/entidad-listing-client'

export const metadata = {
  title: 'FAS — Entidades',
}

export default function Page() {
  return (
    <PageContainer
      pageTitle='Entidades'
      pageDescription='Gestiona clientes, proveedores, productores y demás entidades del sistema.'
      pageHeaderAction={
        <Button asChild>
          <Link href='/dashboard/configuracion/entidades/nueva'>
            <Icons.add className='mr-2 h-4 w-4' />
            Nueva Entidad
          </Link>
        </Button>
      }
    >
      <EntidadListingClient />
    </PageContainer>
  )
}
