import PageContainer from '@/components/layout/page-container'
import { searchParamsCache } from '@/lib/searchparams'
import { SearchParams } from 'nuqs/server'
import { ProductorOperativoListingClient } from '@/features/productores/components/productor-operativo-listing-client'

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
      pageDescription='Listado de productores. Usa el menú de acción para ver predios, contrato y cuenta corriente, o descargar la ficha en PDF.'
    >
      <ProductorOperativoListingClient />
    </PageContainer>
  )
}
