import PageContainer from '@/components/layout/page-container'
import { searchParamsCache } from '@/lib/searchparams'
import { SearchParams } from 'nuqs/server'
import { ConceptoCtaCteFormSheetTrigger } from '@/features/conceptos-cta-cte/components/concepto-form-sheet'
import { ConceptosCtaCteListing } from '@/features/conceptos-cta-cte/components/conceptos-cta-cte-listing'

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
      <ConceptosCtaCteListing />
    </PageContainer>
  )
}
