import PageContainer from '@/components/layout/page-container'
import { searchParamsCache } from '@/lib/searchparams'
import { SearchParams } from 'nuqs/server'
import MantenedorListing from '@/components/shared/mantenedor-simple/mantenedor-listing'
import { MantenedorFormSheetTrigger } from '@/components/shared/mantenedor-simple/mantenedor-form-sheet'

export const metadata = {
  title: 'FAS — Forma de Pago'
}

type PageProps = {
  searchParams: Promise<SearchParams>
}

export default async function Page(props: PageProps) {
  const searchParams = await props.searchParams
  searchParamsCache.parse(searchParams)

  return (
    <PageContainer
      pageTitle='Forma de Pago'
      pageDescription='Formas de pago utilizadas en Órdenes de Compra'
      pageHeaderAction={<MantenedorFormSheetTrigger recurso='formas-pago' titulo='Forma de Pago' />}
    >
      <MantenedorListing recurso='formas-pago' titulo='Forma de Pago' />
    </PageContainer>
  )
}
