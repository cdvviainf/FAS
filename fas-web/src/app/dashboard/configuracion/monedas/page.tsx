import PageContainer from '@/components/layout/page-container'
import { searchParamsCache } from '@/lib/searchparams'
import { SearchParams } from 'nuqs/server'
import MantenedorListing from '@/components/shared/mantenedor-simple/mantenedor-listing'
import { MonedaFormSheetTrigger } from '@/features/monedas/components/moneda-form-sheet'
import { monedaExtraColumns } from '@/features/monedas/components/moneda-columns'

export const metadata = {
  title: 'FAS — Monedas'
}

type PageProps = {
  searchParams: Promise<SearchParams>
}

export default async function Page(props: PageProps) {
  const searchParams = await props.searchParams
  searchParamsCache.parse(searchParams)

  return (
    <PageContainer
      pageTitle='Monedas'
      pageDescription='Monedas utilizadas en operaciones comerciales (ISO 4217).'
      pageHeaderAction={<MonedaFormSheetTrigger />}
    >
      <MantenedorListing recurso='monedas' titulo='Moneda' extraColumns={monedaExtraColumns} />
    </PageContainer>
  )
}
