import PageContainer from '@/components/layout/page-container'
import { searchParamsCache } from '@/lib/searchparams'
import { SearchParams } from 'nuqs/server'
import MantenedorListing from '@/components/shared/mantenedor-simple/mantenedor-listing'
import { MantenedorFormSheetTrigger } from '@/components/shared/mantenedor-simple/mantenedor-form-sheet'

export const metadata = {
  title: 'FAS — Regiones'
}

type PageProps = {
  searchParams: Promise<SearchParams>
}

export default async function Page(props: PageProps) {
  const searchParams = await props.searchParams
  searchParamsCache.parse(searchParams)

  return (
    <PageContainer
      pageTitle='Regiones'
      pageDescription='Regiones para la clasificación geográfica de predios y entidades.'
      pageHeaderAction={<MantenedorFormSheetTrigger recurso='regiones' titulo='Región' />}
    >
      <MantenedorListing recurso='regiones' titulo='Región' />
    </PageContainer>
  )
}
