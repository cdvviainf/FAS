import PageContainer from '@/components/layout/page-container'
import { searchParamsCache } from '@/lib/searchparams'
import { SearchParams } from 'nuqs/server'
import { CaracteristicaMadurezFormSheetTrigger } from '@/features/caracteristicas-madurez/components/caracteristica-madurez-form-sheet'
import { CaracteristicaMadurezListingClient } from '@/features/caracteristicas-madurez/components/caracteristica-madurez-listing-client'

export const metadata = {
  title: 'FAS — Características de Madurez'
}

type PageProps = {
  searchParams: Promise<SearchParams>
}

export default async function Page(props: PageProps) {
  const searchParams = await props.searchParams
  searchParamsCache.parse(searchParams)

  return (
    <PageContainer
      pageTitle='Características de Madurez'
      pageDescription='Características de calidad/madurez (ej. Firmeza, Brix) configurables por especie, capturadas en el cierre de la inspección.'
      pageHeaderAction={<CaracteristicaMadurezFormSheetTrigger />}
    >
      <CaracteristicaMadurezListingClient />
    </PageContainer>
  )
}
