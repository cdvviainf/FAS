import PageContainer from '@/components/layout/page-container'
import { PrefijoCodigoListingClient } from '@/features/prefijos-codigo/components/prefijo-codigo-listing-client'
import { PrefijoCodigoFormSheetTrigger } from '@/features/prefijos-codigo/components/prefijo-codigo-form-sheet'

export const metadata = {
  title: 'FAS — Prefijos de Código'
}

export default function Page() {
  return (
    <PageContainer
      pageTitle='Prefijos de Código'
      pageDescription='Prefijo y cantidad de dígitos del correlativo que se sugiere al crear un registro nuevo en cada mantenedor.'
      pageHeaderAction={<PrefijoCodigoFormSheetTrigger />}
    >
      <PrefijoCodigoListingClient />
    </PageContainer>
  )
}
