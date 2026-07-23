import PageContainer from '@/components/layout/page-container'
import { searchParamsCache } from '@/lib/searchparams'
import { SearchParams } from 'nuqs/server'
import { ArticuloListingClient } from '@/features/materiales/articulos/components/articulo-listing-client'
import { ArticuloFormSheetTrigger } from '@/features/materiales/articulos/components/articulo-form-sheet'

export const metadata = {
  title: 'FAS — Artículos'
}

type PageProps = {
  searchParams: Promise<SearchParams>
}

export default async function Page(props: PageProps) {
  const searchParams = await props.searchParams
  searchParamsCache.parse(searchParams)

  return (
    <PageContainer
      pageTitle='Artículos'
      pageDescription='Maestro de embalajes, envases, materiales de embalaje y servicios.'
      pageHeaderAction={<ArticuloFormSheetTrigger />}
    >
      <ArticuloListingClient />
    </PageContainer>
  )
}
