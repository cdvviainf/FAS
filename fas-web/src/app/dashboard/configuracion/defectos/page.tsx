import PageContainer from '@/components/layout/page-container'
import { searchParamsCache } from '@/lib/searchparams'
import { SearchParams } from 'nuqs/server'
import { DefectoFormSheetTrigger } from '@/features/defectos/components/defecto-form-sheet'
import { DefectoListingClient } from '@/features/defectos/components/defecto-listing-client'

export const metadata = {
  title: 'FAS — Defectos'
}

type PageProps = {
  searchParams: Promise<SearchParams>
}

export default async function Page(props: PageProps) {
  const searchParams = await props.searchParams
  searchParamsCache.parse(searchParams)

  return (
    <PageContainer
      pageTitle='Defectos'
      pageDescription='Defectos de calidad clasificados por grupo (Calidad/Condición) y válidos por especie.'
      pageHeaderAction={<DefectoFormSheetTrigger />}
    >
      <DefectoListingClient />
    </PageContainer>
  )
}
