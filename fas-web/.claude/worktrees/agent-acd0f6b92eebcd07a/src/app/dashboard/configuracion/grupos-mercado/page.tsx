import PageContainer from '@/components/layout/page-container'
import { searchParamsCache } from '@/lib/searchparams'
import { SearchParams } from 'nuqs/server'
import MantenedorListing from '@/components/shared/mantenedor-simple/mantenedor-listing'
import { MantenedorFormSheetTrigger } from '@/components/shared/mantenedor-simple/mantenedor-form-sheet'

export const metadata = {
  title: 'FAS — Grupo de Mercado'
}

type PageProps = {
  searchParams: Promise<SearchParams>
}

export default async function Page(props: PageProps) {
  const searchParams = await props.searchParams
  searchParamsCache.parse(searchParams)

  return (
    <PageContainer
      pageTitle='Grupo de Mercado'
      pageDescription='Grupos de mercado para clasificación de destinos'
      pageHeaderAction={<MantenedorFormSheetTrigger recurso='grupos-mercado' titulo='Grupo de Mercado' />}
    >
      <MantenedorListing recurso='grupos-mercado' titulo='Grupo de Mercado' />
    </PageContainer>
  )
}
