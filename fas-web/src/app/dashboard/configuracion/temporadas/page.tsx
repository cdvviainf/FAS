import PageContainer from '@/components/layout/page-container'
import { searchParamsCache } from '@/lib/searchparams'
import { SearchParams } from 'nuqs/server'
import { TemporadaFormSheetTrigger } from '@/features/temporadas/components/temporada-form-sheet'
import { TemporadaListingClient } from '@/features/temporadas/components/temporada-listing-client'

export const metadata = {
  title: 'FAS — Temporadas'
}

type PageProps = {
  searchParams: Promise<SearchParams>
}

export default async function Page(props: PageProps) {
  const searchParams = await props.searchParams
  searchParamsCache.parse(searchParams)

  return (
    <PageContainer
      pageTitle='Temporadas'
      pageDescription='Temporadas fruteras con rangos de fecha. Los rangos no pueden solaparse.'
      pageHeaderAction={<TemporadaFormSheetTrigger />}
    >
      <TemporadaListingClient />
    </PageContainer>
  )
}
