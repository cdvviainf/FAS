import PageContainer from '@/components/layout/page-container'
import { ProformasListingClient } from '@/features/facturacion-exportacion/components/proformas-listing-client'

export const metadata = {
  title: 'FAS — Facturación Exportación',
}

export default function Page() {
  return (
    <PageContainer
      pageTitle='Facturación Exportación'
      pageDescription='Proforma por Embarque — primera etapa del proceso de facturación de exportación.'
    >
      <ProformasListingClient />
    </PageContainer>
  )
}
