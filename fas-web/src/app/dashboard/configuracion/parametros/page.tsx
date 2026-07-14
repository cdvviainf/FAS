import PageContainer from '@/components/layout/page-container'
import { searchParamsCache } from '@/lib/searchparams'
import { SearchParams } from 'nuqs/server'
import MantenedorListing from '@/components/shared/mantenedor-simple/mantenedor-listing'
import { ParametroFormSheetTrigger } from '@/features/parametros/components/parametro-form-sheet'
import { parametroExtraColumns } from '@/features/parametros/components/parametro-columns'

export const metadata = {
  title: 'FAS — Parámetros'
}

type PageProps = {
  searchParams: Promise<SearchParams>
}

export default async function Page(props: PageProps) {
  const searchParams = await props.searchParams
  searchParamsCache.parse(searchParams)

  return (
    <PageContainer
      pageTitle='Parámetros'
      pageDescription='Parámetros de calidad agrupados por tipo (ej: Brix, Firmeza, Coloración).'
      pageHeaderAction={<ParametroFormSheetTrigger />}
    >
      <MantenedorListing recurso='parametros' titulo='Parámetro' extraColumns={parametroExtraColumns} />
    </PageContainer>
  )
}
