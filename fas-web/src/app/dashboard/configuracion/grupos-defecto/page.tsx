import PageContainer from '@/components/layout/page-container'
import { searchParamsCache } from '@/lib/searchparams'
import { SearchParams } from 'nuqs/server'
import { GrupoDefectoFormSheetTrigger } from '@/features/grupos-defecto/components/grupo-defecto-form-sheet'
import { GrupoDefectoListingClient } from '@/features/grupos-defecto/components/grupo-defecto-listing-client'

export const metadata = {
  title: 'FAS — Grupos de Defecto'
}

type PageProps = {
  searchParams: Promise<SearchParams>
}

export default async function Page(props: PageProps) {
  const searchParams = await props.searchParams
  searchParamsCache.parse(searchParams)

  return (
    <PageContainer
      pageTitle='Grupos de Defecto'
      pageDescription='Agrupaciones de defectos dentro de un tipo de defecto (ej: Calidad, Condición).'
      pageHeaderAction={<GrupoDefectoFormSheetTrigger />}
    >
      <GrupoDefectoListingClient />
    </PageContainer>
  )
}
