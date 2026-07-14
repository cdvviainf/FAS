import PageContainer from '@/components/layout/page-container'
import { searchParamsCache } from '@/lib/searchparams'
import { SearchParams } from 'nuqs/server'
import MantenedorListing from '@/components/shared/mantenedor-simple/mantenedor-listing'
import { VariedadFormSheetTrigger } from '@/features/variedades/components/variedad-form-sheet'
import { variedadExtraColumns } from '@/features/variedades/components/variedad-columns'

export const metadata = {
  title: 'FAS — Variedades'
}

type PageProps = {
  searchParams: Promise<SearchParams>
}

export default async function Page(props: PageProps) {
  const searchParams = await props.searchParams
  searchParamsCache.parse(searchParams)

  return (
    <PageContainer
      pageTitle='Variedades'
      pageDescription='Variedades de fruta clasificadas por especie y grupo de variedad.'
      pageHeaderAction={<VariedadFormSheetTrigger />}
    >
      <MantenedorListing recurso='variedades' titulo='Variedad' extraColumns={variedadExtraColumns} />
    </PageContainer>
  )
}
