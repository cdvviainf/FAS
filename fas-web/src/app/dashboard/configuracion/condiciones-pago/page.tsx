import PageContainer from '@/components/layout/page-container'
import { CondicionPagoListingClient } from '@/features/condiciones-pago/components/condicion-pago-listing-client'
import { CondicionPagoFormSheetTrigger } from '@/features/condiciones-pago/components/condicion-pago-form-sheet'

export const metadata = {
  title: 'FAS — Condiciones de Pago'
}

export default function Page() {
  return (
    <PageContainer
      pageTitle='Condiciones de Pago'
      pageDescription='Cuotas (% y plazo en días) que determinan automáticamente el pago de una Orden de Compra.'
      pageHeaderAction={<CondicionPagoFormSheetTrigger />}
    >
      <CondicionPagoListingClient />
    </PageContainer>
  )
}
