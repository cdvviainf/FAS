import PageContainer from '@/components/layout/page-container'
import { SolicitudPagoListingClient } from '@/features/productores/solicitudes-pago/components/solicitud-pago-listing-client'

export const metadata = {
  title: 'FAS — Solicitud de Pago',
}

export default function Page() {
  return (
    <PageContainer
      pageTitle='Solicitud de Pago'
      pageDescription='Pago a productores por cuotas de la condición de pago de la OC, sobre lo realmente despachado.'
    >
      <SolicitudPagoListingClient />
    </PageContainer>
  )
}
