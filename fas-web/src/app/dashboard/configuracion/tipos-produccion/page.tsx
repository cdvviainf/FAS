import PageContainer from '@/components/layout/page-container'
import { searchParamsCache } from '@/lib/searchparams'
import { SearchParams } from 'nuqs/server'
import MantenedorListing from '@/components/shared/mantenedor-simple/mantenedor-listing'
import { MantenedorFormSheetTrigger } from '@/components/shared/mantenedor-simple/mantenedor-form-sheet'

export const metadata = {
  title: 'FAS — Tipo de Producción'
}

type PageProps = {
  searchParams: Promise<SearchParams>
}

export default async function Page(props: PageProps) {
  const searchParams = await props.searchParams
  searchParamsCache.parse(searchParams)

  return (
    <PageContainer
      pageTitle='Tipo de Producción'
      pageDescription='Tipos de producción aplicables a la fruta'
      pageHeaderAction={<MantenedorFormSheetTrigger recurso='tipos-produccion' titulo='Tipo de Producción' />}
    >
      <MantenedorListing recurso='tipos-produccion' titulo='Tipo de Producción' />
    </PageContainer>
  )
}
