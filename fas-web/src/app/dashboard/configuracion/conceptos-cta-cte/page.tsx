import PageContainer from '@/components/layout/page-container'
import { searchParamsCache } from '@/lib/searchparams'
import { SearchParams } from 'nuqs/server'
import MantenedorListing from '@/components/shared/mantenedor-simple/mantenedor-listing'
import { ConceptoCtaCteFormSheetTrigger } from '@/features/conceptos-cta-cte/components/concepto-form-sheet'
import { conceptoExtraColumns } from '@/features/conceptos-cta-cte/components/concepto-columns'

export const metadata = {
  title: 'FAS — Conceptos Cta. Cte.'
}

type PageProps = {
  searchParams: Promise<SearchParams>
}

export default async function Page(props: PageProps) {
  const searchParams = await props.searchParams
  searchParamsCache.parse(searchParams)

  return (
    <PageContainer
      pageTitle='Conceptos Cta. Cte.'
      pageDescription='Conceptos de debe y haber para la cuenta corriente del productor.'
      pageHeaderAction={<ConceptoCtaCteFormSheetTrigger />}
    >
      <MantenedorListing recurso='conceptos-cta-cte' titulo='Concepto' extraColumns={conceptoExtraColumns} />
    </PageContainer>
  )
}
