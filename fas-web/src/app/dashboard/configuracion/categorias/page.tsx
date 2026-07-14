import PageContainer from '@/components/layout/page-container'
import { searchParamsCache } from '@/lib/searchparams'
import { SearchParams } from 'nuqs/server'
import MantenedorListing from '@/components/shared/mantenedor-simple/mantenedor-listing'
import { CategoriaFormSheetTrigger } from '@/features/categorias/components/categoria-form-sheet'
import { categoriaExtraColumns } from '@/features/categorias/components/categoria-columns'

export const metadata = {
  title: 'FAS — Categorías'
}

type PageProps = {
  searchParams: Promise<SearchParams>
}

export default async function Page(props: PageProps) {
  const searchParams = await props.searchParams
  searchParamsCache.parse(searchParams)

  return (
    <PageContainer
      pageTitle='Categorías'
      pageDescription='Categorías de fruta por especie con orden de clasificación (ej: Primera, Segunda).'
      pageHeaderAction={<CategoriaFormSheetTrigger />}
    >
      <MantenedorListing recurso='categorias' titulo='Categoría' extraColumns={categoriaExtraColumns} />
    </PageContainer>
  )
}
