import PageContainer from '@/components/layout/page-container'
import { searchParamsCache } from '@/lib/searchparams'
import { SearchParams } from 'nuqs/server'
import MantenedorListing from '@/components/shared/mantenedor-simple/mantenedor-listing'
import { MantenedorFormSheetTrigger } from '@/components/shared/mantenedor-simple/mantenedor-form-sheet'

export const metadata = {
  title: 'FAS — Altura'
}

type PageProps = {
  searchParams: Promise<SearchParams>
}

export default async function Page(props: PageProps) {
  const searchParams = await props.searchParams
  searchParamsCache.parse(searchParams)

  return (
    <PageContainer
      pageTitle='Altura'
      pageDescription='Alturas de apilado para clasificación de carga'
      pageHeaderAction={<MantenedorFormSheetTrigger recurso='alturas' titulo='Altura' />}
    >
      <MantenedorListing recurso='alturas' titulo='Altura' />
    </PageContainer>
  )
}
