import PageContainer from '@/components/layout/page-container'
import { searchParamsCache } from '@/lib/searchparams'
import { SearchParams } from 'nuqs/server'
import { MercadoFormSheetTrigger } from '@/features/mercados/components/mercado-form-sheet'
import { MercadosClientTable } from '@/features/mercados/components/mercados-client-table'

export const metadata = {
  title: 'FAS — Mercados'
}

type PageProps = {
  searchParams: Promise<SearchParams>
}

export default async function Page(props: PageProps) {
  const searchParams = await props.searchParams
  searchParamsCache.parse(searchParams)

  return (
    <PageContainer
      pageTitle='Mercados'
      pageDescription='Mercados de destino para exportación, clasificados por grupo y país.'
      pageHeaderAction={<MercadoFormSheetTrigger />}
    >
      <MercadosClientTable />
    </PageContainer>
  )
}
