import PageContainer from '@/components/layout/page-container'
import { searchParamsCache } from '@/lib/searchparams'
import { SearchParams } from 'nuqs/server'
import MantenedorListing from '@/components/shared/mantenedor-simple/mantenedor-listing'
import { ComunaFormSheetTrigger } from '@/features/comunas/components/comuna-form-sheet'
import { comunaExtraColumns } from '@/features/comunas/components/comuna-columns'

export const metadata = {
  title: 'FAS — Comunas'
}

type PageProps = {
  searchParams: Promise<SearchParams>
}

export default async function Page(props: PageProps) {
  const searchParams = await props.searchParams
  searchParamsCache.parse(searchParams)

  return (
    <PageContainer
      pageTitle='Comunas'
      pageDescription='Comunas agrupadas por provincia y región.'
      pageHeaderAction={<ComunaFormSheetTrigger />}
    >
      <MantenedorListing recurso='comunas' titulo='Comuna' extraColumns={comunaExtraColumns} />
    </PageContainer>
  )
}
