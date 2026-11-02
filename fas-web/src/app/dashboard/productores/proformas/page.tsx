import PageContainer from '@/components/layout/page-container'
import { ProformaProductorListingClient } from '@/features/productores/proformas-servicio/components/proforma-productor-listing-client'

export const metadata = {
  title: 'FAS — Proforma a Productores',
}

export default function Page() {
  return (
    <PageContainer
      pageTitle='Proforma a Productores'
      pageDescription='Proforma de servicios prestados a un productor. Al enviarla a validación queda lista para generar una Factura Nacional.'
    >
      <ProformaProductorListingClient />
    </PageContainer>
  )
}
