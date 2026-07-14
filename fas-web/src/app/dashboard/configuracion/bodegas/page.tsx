import PageContainer from '@/components/layout/page-container'
import { searchParamsCache } from '@/lib/searchparams'
import { SearchParams } from 'nuqs/server'
import { BodegaFormSheetTrigger } from '@/features/bodegas/components/bodega-form-sheet'
import { BodegaListingClient } from '@/features/bodegas/components/bodega-listing-client'

export const metadata = {
  title: 'FAS — Bodegas'
}

type PageProps = {
  searchParams: Promise<SearchParams>
}

export default async function Page(props: PageProps) {
  const searchParams = await props.searchParams
  searchParamsCache.parse(searchParams)

  return (
    <PageContainer
      pageTitle='Bodegas'
      pageDescription='Bodegas e instalaciones físicas para almacenamiento y operaciones.'
      pageHeaderAction={<BodegaFormSheetTrigger />}
    >
      <BodegaListingClient />
    </PageContainer>
  )
}
