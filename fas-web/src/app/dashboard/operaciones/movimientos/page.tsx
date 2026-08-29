import PageContainer from '@/components/layout/page-container'
import { searchParamsCache } from '@/lib/searchparams'
import { SearchParams } from 'nuqs/server'
import { MovimientoListingClient } from '@/features/materiales/movimientos/components/movimiento-listing-client'

export const metadata = {
  title: 'FAS — Movimientos'
}

type PageProps = {
  searchParams: Promise<SearchParams>
}

export default async function Page(props: PageProps) {
  const searchParams = await props.searchParams
  searchParamsCache.parse(searchParams)

  return (
    <PageContainer
      pageTitle='Materiales y Envases'
      pageDescription='Registro de movimientos de stock: entradas, salidas y traslados.'
    >
      <MovimientoListingClient />
    </PageContainer>
  )
}
