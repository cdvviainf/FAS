import PageContainer from '@/components/layout/page-container'
import { searchParamsCache } from '@/lib/searchparams'
import { SearchParams } from 'nuqs/server'
import { ParametroFormSheetTrigger } from '@/features/parametros/components/parametro-form-sheet'
import { ParametroListingClient } from '@/features/parametros/components/parametro-listing-client'

export const metadata = {
  title: 'FAS — Parámetros'
}

type PageProps = {
  searchParams: Promise<SearchParams>
}

export default async function Page(props: PageProps) {
  const searchParams = await props.searchParams
  searchParamsCache.parse(searchParams)

  return (
    <PageContainer
      pageTitle='Parámetros'
      pageDescription='Parámetros de calidad agrupados por tipo (ej: Brix, Firmeza, Coloración).'
      pageHeaderAction={<ParametroFormSheetTrigger />}
    >
      <ParametroListingClient />
    </PageContainer>
  )
}
