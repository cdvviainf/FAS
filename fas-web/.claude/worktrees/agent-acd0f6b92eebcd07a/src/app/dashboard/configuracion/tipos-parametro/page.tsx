import PageContainer from '@/components/layout/page-container'
import { searchParamsCache } from '@/lib/searchparams'
import { SearchParams } from 'nuqs/server'
import MantenedorListing from '@/components/shared/mantenedor-simple/mantenedor-listing'
import { MantenedorFormSheetTrigger } from '@/components/shared/mantenedor-simple/mantenedor-form-sheet'

export const metadata = {
  title: 'FAS — Tipo de Parámetro'
}

type PageProps = {
  searchParams: Promise<SearchParams>
}

export default async function Page(props: PageProps) {
  const searchParams = await props.searchParams
  searchParamsCache.parse(searchParams)

  return (
    <PageContainer
      pageTitle='Tipo de Parámetro'
      pageDescription='Tipos de parámetros de configuración del sistema'
      pageHeaderAction={<MantenedorFormSheetTrigger recurso='tipos-parametro' titulo='Tipo de Parámetro' />}
    >
      <MantenedorListing recurso='tipos-parametro' titulo='Tipo de Parámetro' />
    </PageContainer>
  )
}
