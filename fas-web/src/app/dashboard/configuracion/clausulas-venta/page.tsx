import PageContainer from '@/components/layout/page-container'
import { searchParamsCache } from '@/lib/searchparams'
import { SearchParams } from 'nuqs/server'
import { ClausulaVentaFormSheetTrigger } from '@/features/clausulas-venta/components/clausula-venta-form-sheet'
import { ClausulaVentaListingClient } from '@/features/clausulas-venta/components/clausula-venta-listing-client'

export const metadata = {
  title: 'FAS — Cláusulas de Venta (Incoterm)'
}

type PageProps = {
  searchParams: Promise<SearchParams>
}

export default async function Page(props: PageProps) {
  const searchParams = await props.searchParams
  searchParamsCache.parse(searchParams)

  return (
    <PageContainer
      pageTitle='Cláusulas de Venta (Incoterm)'
      pageDescription='FOB, CIF, C+F, etc. Determina si al facturar/proformar con esta cláusula se exige informar Flete y/o Seguro.'
      pageHeaderAction={<ClausulaVentaFormSheetTrigger />}
    >
      <ClausulaVentaListingClient />
    </PageContainer>
  )
}
