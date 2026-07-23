import PageContainer from '@/components/layout/page-container'
import { searchParamsCache } from '@/lib/searchparams'
import { SearchParams } from 'nuqs/server'
import { ProductorListingClient } from '@/features/productores/components/productor-listing-client'

export const metadata = {
  title: 'FAS — Productores'
}

type PageProps = {
  searchParams: Promise<SearchParams>
}

export default async function Page(props: PageProps) {
  const searchParams = await props.searchParams
  searchParamsCache.parse(searchParams)

  return (
    <PageContainer
      pageTitle='Productores'
      pageDescription='Ficha de productores: predios, contrato y cuenta corriente.'
    >
      <ProductorListingClient />
    </PageContainer>
  )
}
