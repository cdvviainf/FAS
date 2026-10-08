import PageContainer from '@/components/layout/page-container'
import { searchParamsCache } from '@/lib/searchparams'
import { SearchParams } from 'nuqs/server'
import { TipoEmbarqueFormSheetTrigger } from '@/features/tipos-embarque/components/tipo-embarque-form-sheet'
import { TipoEmbarqueListingClient } from '@/features/tipos-embarque/components/tipo-embarque-listing-client'

export const metadata = {
  title: 'FAS — Tipo de Embarque'
}

type PageProps = {
  searchParams: Promise<SearchParams>
}

export default async function Page(props: PageProps) {
  const searchParams = await props.searchParams
  searchParamsCache.parse(searchParams)

  return (
    <PageContainer
      pageTitle='Tipo de Embarque'
      pageDescription='Tipos de embarque disponibles para exportación. El flag "Requiere Reserva" decide si al generar un Embarque se envía la Solicitud de Reserva (solo Aéreo/Marítimo).'
      pageHeaderAction={<TipoEmbarqueFormSheetTrigger />}
    >
      <TipoEmbarqueListingClient />
    </PageContainer>
  )
}
