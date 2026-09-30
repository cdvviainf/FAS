import PageContainer from '@/components/layout/page-container'
import { EmbarquesExportacionListingClient } from '@/features/facturacion-exportacion/components/embarques-exportacion-listing-client'

export const metadata = {
  title: 'FAS — Facturación Exportación',
}

export default function Page() {
  return (
    <PageContainer
      pageTitle='Facturación Exportación'
      pageDescription='Embarques despachados con el estado de su Proforma y Factura (SII).'
    >
      <EmbarquesExportacionListingClient />
    </PageContainer>
  )
}
