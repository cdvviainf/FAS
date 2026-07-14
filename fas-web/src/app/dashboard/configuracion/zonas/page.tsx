import PageContainer from '@/components/layout/page-container'
import { searchParamsCache } from '@/lib/searchparams'
import { SearchParams } from 'nuqs/server'
import MantenedorListing from '@/components/shared/mantenedor-simple/mantenedor-listing'
import { MantenedorFormSheetTrigger } from '@/components/shared/mantenedor-simple/mantenedor-form-sheet'

export const metadata = {
  title: 'FAS — Zona'
}

type PageProps = {
  searchParams: Promise<SearchParams>
}

export default async function Page(props: PageProps) {
  const searchParams = await props.searchParams
  searchParamsCache.parse(searchParams)

  return (
    <PageContainer
      pageTitle='Zona'
      pageDescription='Zonas geográficas del sistema'
      pageHeaderAction={<MantenedorFormSheetTrigger recurso='zonas' titulo='Zona' />}
    >
      <MantenedorListing recurso='zonas' titulo='Zona' />
    </PageContainer>
  )
}
