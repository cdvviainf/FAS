import PageContainer from '@/components/layout/page-container'
import { searchParamsCache } from '@/lib/searchparams'
import { SearchParams } from 'nuqs/server'
import MantenedorListing from '@/components/shared/mantenedor-simple/mantenedor-listing'
import { MantenedorFormSheetTrigger } from '@/components/shared/mantenedor-simple/mantenedor-form-sheet'

export const metadata = {
  title: 'FAS — Tipo de Embarque'
}

type PageProps = {
  searchParams: Promise<SearchParams>
}

export default async function Page(props: PageProps) {
  const searchParams = await props.searchParams
  searchParamsCache.parse(searchParams)

  return (
    <PageContainer
      pageTitle='Tipo de Embarque'
      pageDescription='Tipos de embarque disponibles para exportación'
      pageHeaderAction={<MantenedorFormSheetTrigger recurso='tipos-embarque' titulo='Tipo de Embarque' />}
    >
      <MantenedorListing recurso='tipos-embarque' titulo='Tipo de Embarque' />
    </PageContainer>
  )
}
