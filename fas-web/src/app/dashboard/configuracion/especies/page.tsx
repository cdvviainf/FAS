import PageContainer from '@/components/layout/page-container'
import { searchParamsCache } from '@/lib/searchparams'
import { SearchParams } from 'nuqs/server'
import { EspecieFormSheetTrigger } from '@/features/especies/components/especie-form-sheet'
import { EspecieListingClient } from '@/features/especies/components/especie-listing-client'

export const metadata = {
  title: 'FAS — Especies'
}

type PageProps = {
  searchParams: Promise<SearchParams>
}

export default async function Page(props: PageProps) {
  const searchParams = await props.searchParams
  searchParamsCache.parse(searchParams)

  return (
    <PageContainer
      pageTitle='Especies'
      pageDescription='Especies de fruta (uva, cereza, durazno, etc.) padre de variedades, categorías y calibres.'
      pageHeaderAction={<EspecieFormSheetTrigger />}
    >
      <EspecieListingClient />
    </PageContainer>
  )
}
