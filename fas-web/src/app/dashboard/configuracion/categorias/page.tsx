import PageContainer from '@/components/layout/page-container'
import { searchParamsCache } from '@/lib/searchparams'
import { SearchParams } from 'nuqs/server'
import { CategoriaFormSheetTrigger } from '@/features/categorias/components/categoria-form-sheet'
import { CategoriaListingClient } from '@/features/categorias/components/categoria-listing-client'

export const metadata = {
  title: 'FAS — Categorías'
}

type PageProps = {
  searchParams: Promise<SearchParams>
}

export default async function Page(props: PageProps) {
  const searchParams = await props.searchParams
  searchParamsCache.parse(searchParams)

  return (
    <PageContainer
      pageTitle='Categorías'
      pageDescription='Categorías de fruta por especie con orden de clasificación (ej: Primera, Segunda).'
      pageHeaderAction={<CategoriaFormSheetTrigger />}
    >
      <CategoriaListingClient />
    </PageContainer>
  )
}
