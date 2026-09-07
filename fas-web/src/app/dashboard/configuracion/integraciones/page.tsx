import PageContainer from '@/components/layout/page-container'
import { searchParamsCache } from '@/lib/searchparams'
import { SearchParams } from 'nuqs/server'
import { IntegracionListingClient } from '@/features/integraciones/components/integracion-listing-client'

export const metadata = {
  title: 'FAS — Integraciones'
}

type PageProps = {
  searchParams: Promise<SearchParams>
}

export default async function Page(props: PageProps) {
  const searchParams = await props.searchParams
  searchParamsCache.parse(searchParams)

  return (
    <PageContainer
      pageTitle='Integraciones'
      pageDescription='Credenciales y parámetros de sistemas externos (ej. AGL360).'
    >
      <IntegracionListingClient />
    </PageContainer>
  )
}
