import PageContainer from '@/components/layout/page-container'
import { searchParamsCache } from '@/lib/searchparams'
import { SearchParams } from 'nuqs/server'
import MantenedorListing from '@/components/shared/mantenedor-simple/mantenedor-listing'
import { CalibreFormSheetTrigger } from '@/features/calibres/components/calibre-form-sheet'
import { calibreExtraColumns } from '@/features/calibres/components/calibre-columns'

export const metadata = {
  title: 'FAS — Calibres'
}

type PageProps = {
  searchParams: Promise<SearchParams>
}

export default async function Page(props: PageProps) {
  const searchParams = await props.searchParams
  searchParamsCache.parse(searchParams)

  return (
    <PageContainer
      pageTitle='Calibres'
      pageDescription='Calibres de fruta por especie con orden de clasificación (ej: XL, L, M).'
      pageHeaderAction={<CalibreFormSheetTrigger />}
    >
      <MantenedorListing recurso='calibres' titulo='Calibre' extraColumns={calibreExtraColumns} />
    </PageContainer>
  )
}
