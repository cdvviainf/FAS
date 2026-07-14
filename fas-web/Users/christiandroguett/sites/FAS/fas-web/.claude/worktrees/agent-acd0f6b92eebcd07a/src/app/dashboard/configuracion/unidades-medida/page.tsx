import PageContainer from '@/components/layout/page-container'
import { searchParamsCache } from '@/lib/searchparams'
import { SearchParams } from 'nuqs/server'
import MantenedorListing from '@/components/shared/mantenedor-simple/mantenedor-listing'
import { MantenedorFormSheetTrigger } from '@/components/shared/mantenedor-simple/mantenedor-form-sheet'

export const metadata = {
  title: 'FAS — Unidad de Medida'
}

type PageProps = {
  searchParams: Promise<SearchParams>
}

export default async function Page(props: PageProps) {
  const searchParams = await props.searchParams
  searchParamsCache.parse(searchParams)

  return (
    <PageContainer
      pageTitle='Unidad de Medida'
      pageDescription='Unidades de medida utilizadas en el sistema'
      pageHeaderAction={<MantenedorFormSheetTrigger recurso='unidades-medida' titulo='Unidad de Medida' />}
    >
      <MantenedorListing recurso='unidades-medida' titulo='Unidad de Medida' />
    </PageContainer>
  )
}
