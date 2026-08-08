import PageContainer from '@/components/layout/page-container'
import { searchParamsCache } from '@/lib/searchparams'
import { SearchParams } from 'nuqs/server'
import MantenedorListing from '@/components/shared/mantenedor-simple/mantenedor-listing'
import { MantenedorFormSheetTrigger } from '@/components/shared/mantenedor-simple/mantenedor-form-sheet'

export const metadata = {
  title: 'FAS — Etiqueta'
}

type PageProps = {
  searchParams: Promise<SearchParams>
}

export default async function Page(props: PageProps) {
  const searchParams = await props.searchParams
  searchParamsCache.parse(searchParams)

  return (
    <PageContainer
      pageTitle='Etiqueta'
      pageDescription='Etiquetas de embalaje, elegibles en el maestro de Artículos'
      pageHeaderAction={<MantenedorFormSheetTrigger recurso='etiquetas' titulo='Etiqueta' />}
    >
      <MantenedorListing recurso='etiquetas' titulo='Etiqueta' />
    </PageContainer>
  )
}
