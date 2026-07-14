import PageContainer from '@/components/layout/page-container'
import { searchParamsCache } from '@/lib/searchparams'
import { SearchParams } from 'nuqs/server'
import MantenedorListing from '@/components/shared/mantenedor-simple/mantenedor-listing'
import { MantenedorFormSheetTrigger } from '@/components/shared/mantenedor-simple/mantenedor-form-sheet'

export const metadata = {
  title: 'FAS — Tipo de Defecto'
}

type PageProps = {
  searchParams: Promise<SearchParams>
}

export default async function Page(props: PageProps) {
  const searchParams = await props.searchParams
  searchParamsCache.parse(searchParams)

  return (
    <PageContainer
      pageTitle='Tipo de Defecto'
      pageDescription='Tipos de defectos para inspecciones de calidad'
      pageHeaderAction={<MantenedorFormSheetTrigger recurso='tipos-defecto' titulo='Tipo de Defecto' />}
    >
      <MantenedorListing recurso='tipos-defecto' titulo='Tipo de Defecto' />
    </PageContainer>
  )
}
