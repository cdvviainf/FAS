import PageContainer from '@/components/layout/page-container'
import { searchParamsCache } from '@/lib/searchparams'
import { SearchParams } from 'nuqs/server'
import { TipoReclamoFormSheetTrigger } from '@/features/tipos-reclamo/components/tipo-reclamo-form-sheet'
import { TipoReclamoListingClient } from '@/features/tipos-reclamo/components/tipo-reclamo-listing-client'

export const metadata = {
  title: 'FAS — Tipos de Reclamo'
}

type PageProps = {
  searchParams: Promise<SearchParams>
}

export default async function Page(props: PageProps) {
  const searchParams = await props.searchParams
  searchParamsCache.parse(searchParams)

  return (
    <PageContainer
      pageTitle='Tipos de Reclamo'
      pageDescription='Clasifica los reclamos. El flag "Genera análisis de Calidad" decide si un reclamo de este tipo pasa a Calidad (además de Ventas).'
      pageHeaderAction={<TipoReclamoFormSheetTrigger />}
    >
      <TipoReclamoListingClient />
    </PageContainer>
  )
}
