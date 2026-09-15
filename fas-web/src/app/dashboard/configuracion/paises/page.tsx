import PageContainer from '@/components/layout/page-container'
import { searchParamsCache } from '@/lib/searchparams'
import { SearchParams } from 'nuqs/server'
import { PaisFormSheetTrigger } from '@/components/shared/mantenedor-simple/pais-form-sheet'
import { PaisesListing } from '@/features/paises/components/paises-listing'

export const metadata = {
  title: 'FAS — Países'
}

type PageProps = {
  searchParams: Promise<SearchParams>
}

export default async function Page(props: PageProps) {
  const searchParams = await props.searchParams
  searchParamsCache.parse(searchParams)

  return (
    <PageContainer
      pageTitle='Países'
      pageDescription='Países de origen y destino para operaciones de exportación.'
      pageHeaderAction={<PaisFormSheetTrigger />}
    >
      <PaisesListing />
    </PageContainer>
  )
}
