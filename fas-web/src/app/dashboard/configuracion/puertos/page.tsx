import PageContainer from '@/components/layout/page-container'
import { searchParamsCache } from '@/lib/searchparams'
import { SearchParams } from 'nuqs/server'
import { PuertoFormSheetTrigger } from '@/features/puertos/components/puerto-form-sheet'
import { PuertoListingClient } from '@/features/puertos/components/puerto-listing-client'

export const metadata = {
  title: 'FAS — Puertos'
}

type PageProps = {
  searchParams: Promise<SearchParams>
}

export default async function Page(props: PageProps) {
  const searchParams = await props.searchParams
  searchParamsCache.parse(searchParams)

  return (
    <PageContainer
      pageTitle='Puertos'
      pageDescription='Puertos de origen y destino para embarques de fruta.'
      pageHeaderAction={<PuertoFormSheetTrigger />}
    >
      <PuertoListingClient />
    </PageContainer>
  )
}
