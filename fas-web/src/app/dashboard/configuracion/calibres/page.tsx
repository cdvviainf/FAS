import PageContainer from '@/components/layout/page-container'
import { searchParamsCache } from '@/lib/searchparams'
import { SearchParams } from 'nuqs/server'
import { CalibreFormSheetTrigger } from '@/features/calibres/components/calibre-form-sheet'
import { CalibreListingClient } from '@/features/calibres/components/calibre-listing-client'

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
      <CalibreListingClient />
    </PageContainer>
  )
}
