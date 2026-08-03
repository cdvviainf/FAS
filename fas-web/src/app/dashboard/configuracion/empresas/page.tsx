import PageContainer from '@/components/layout/page-container'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Icons } from '@/components/icons'
import { EmpresaListingClient } from '@/features/empresas/components/empresa-listing-client'

export const metadata = {
  title: 'FAS — Empresas',
}

export default function Page() {
  return (
    <PageContainer
      pageTitle='Empresas'
      pageDescription='Gestiona las empresas del sistema (razón social, direcciones, contactos y SMTP).'
      pageHeaderAction={
        <Button asChild>
          <Link href='/dashboard/configuracion/empresas/nueva'>
            <Icons.add className='mr-2 h-4 w-4' />
            Nueva Empresa
          </Link>
        </Button>
      }
    >
      <EmpresaListingClient />
    </PageContainer>
  )
}
