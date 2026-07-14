import PageContainer from '@/components/layout/page-container'
import { searchParamsCache } from '@/lib/searchparams'
import { SearchParams } from 'nuqs/server'
import MantenedorListing from '@/components/shared/mantenedor-simple/mantenedor-listing'
import { PuertoFormSheetTrigger } from '@/features/puertos/components/puerto-form-sheet'
import { puertoExtraColumns } from '@/features/puertos/components/puerto-columns'

export const metadata = {
  title: 'FAS — Puertos'
}

type PageProps = {
  searchParams: Promise<SearchParams>
}

export default async function Page(props: PageProps) {
  const searchParams = await props.searchParams
  searchParamsCache.parse(searchParams)

  return (
    <PageContainer
      pageTitle='Puertos'
      pageDescription='Puertos de origen y destino para embarques de fruta.'
      pageHeaderAction={<PuertoFormSheetTrigger />}
    >
      <MantenedorListing recurso='puertos' titulo='Puerto' extraColumns={puertoExtraColumns} />
    </PageContainer>
  )
}
