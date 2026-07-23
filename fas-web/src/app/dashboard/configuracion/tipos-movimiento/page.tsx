import PageContainer from '@/components/layout/page-container'
import { searchParamsCache } from '@/lib/searchparams'
import { SearchParams } from 'nuqs/server'
import { TipoMovimientoListingClient } from '@/features/materiales/tipos-movimiento/components/tipo-movimiento-listing-client'
import { TipoMovimientoFormSheetTrigger } from '@/features/materiales/tipos-movimiento/components/tipo-movimiento-form-sheet'

export const metadata = {
  title: 'FAS — Tipos de Movimiento'
}

type PageProps = {
  searchParams: Promise<SearchParams>
}

export default async function Page(props: PageProps) {
  const searchParams = await props.searchParams
  searchParamsCache.parse(searchParams)

  return (
    <PageContainer
      pageTitle='Tipos de Movimiento'
      pageDescription='Mantenedor transversal de tipos de movimiento de stock (Materiales y Fruta).'
      pageHeaderAction={<TipoMovimientoFormSheetTrigger />}
    >
      <TipoMovimientoListingClient />
    </PageContainer>
  )
}
