import PageContainer from '@/components/layout/page-container'
import { searchParamsCache } from '@/lib/searchparams'
import { SearchParams } from 'nuqs/server'
import MantenedorListing from '@/components/shared/mantenedor-simple/mantenedor-listing'
import { PaisFormSheetTrigger } from '@/components/shared/mantenedor-simple/pais-form-sheet'
import { paisExtraColumns } from '@/components/shared/mantenedor-simple/pais-columns'

export const metadata = {
  title: 'FAS — Países'
}

type PageProps = {
  searchParams: Promise<SearchParams>
}

export default async function Page(props: PageProps) {
  const searchParams = await props.searchParams
  searchParamsCache.parse(searchParams)

  return (
    <PageContainer
      pageTitle='Países'
      pageDescription='Países de origen y destino para operaciones de exportación.'
      pageHeaderAction={<PaisFormSheetTrigger />}
    >
      <MantenedorListing recurso='paises' titulo='País' extraColumns={paisExtraColumns} />
    </PageContainer>
  )
}
