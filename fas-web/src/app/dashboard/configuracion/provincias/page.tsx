import PageContainer from '@/components/layout/page-container'
import { searchParamsCache } from '@/lib/searchparams'
import { SearchParams } from 'nuqs/server'
import MantenedorListing from '@/components/shared/mantenedor-simple/mantenedor-listing'
import { ProvinciaFormSheetTrigger } from '@/features/provincias/components/provincia-form-sheet'
import { provinciaExtraColumns } from '@/features/provincias/components/provincia-columns'

export const metadata = {
  title: 'FAS — Provincias'
}

type PageProps = {
  searchParams: Promise<SearchParams>
}

export default async function Page(props: PageProps) {
  const searchParams = await props.searchParams
  searchParamsCache.parse(searchParams)

  return (
    <PageContainer
      pageTitle='Provincias'
      pageDescription='Provincias agrupadas por región para clasificación geográfica.'
      pageHeaderAction={<ProvinciaFormSheetTrigger />}
    >
      <MantenedorListing recurso='provincias' titulo='Provincia' extraColumns={provinciaExtraColumns} />
    </PageContainer>
  )
}
