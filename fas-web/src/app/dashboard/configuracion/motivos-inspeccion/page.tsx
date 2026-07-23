import PageContainer from '@/components/layout/page-container'
import { searchParamsCache } from '@/lib/searchparams'
import { SearchParams } from 'nuqs/server'
import MantenedorListing from '@/components/shared/mantenedor-simple/mantenedor-listing'
import { MantenedorFormSheetTrigger } from '@/components/shared/mantenedor-simple/mantenedor-form-sheet'

export const metadata = {
  title: 'FAS — Motivos de Inspección'
}

type PageProps = {
  searchParams: Promise<SearchParams>
}

export default async function Page(props: PageProps) {
  const searchParams = await props.searchParams
  searchParamsCache.parse(searchParams)

  return (
    <PageContainer
      pageTitle='Motivos de Inspección'
      pageDescription='Motivos de visita para solicitudes de inspección en terreno'
      pageHeaderAction={<MantenedorFormSheetTrigger recurso='motivos-inspeccion' titulo='Motivo de Inspección' />}
    >
      <MantenedorListing recurso='motivos-inspeccion' titulo='Motivo de Inspección' />
    </PageContainer>
  )
}
