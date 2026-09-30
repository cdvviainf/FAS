import PageContainer from '@/components/layout/page-container'
import { searchParamsCache } from '@/lib/searchparams'
import { SearchParams } from 'nuqs/server'
import MantenedorListing from '@/components/shared/mantenedor-simple/mantenedor-listing'
import { ClausulaVentaFormSheet, ClausulaVentaFormSheetTrigger } from '@/features/clausulas-venta/components/clausula-venta-form-sheet'
import { clausulaVentaExtraColumns } from '@/features/clausulas-venta/components/clausula-venta-columns'

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
      <MantenedorListing
        recurso='clausulas-venta'
        titulo='Cláusula de Venta'
        extraColumns={clausulaVentaExtraColumns}
        renderEditSheet={({ item, open, onOpenChange }) => (
          <ClausulaVentaFormSheet item={item} open={open} onOpenChange={onOpenChange} />
        )}
      />
    </PageContainer>
  )
}
