import PageContainer from '@/components/layout/page-container'
import { FacturasNacionalListingClient } from '@/features/facturacion-nacional/components/facturas-nacional-listing-client'

export const metadata = {
  title: 'FAS — Facturación Nacional',
}

export default function Page() {
  return (
    <PageContainer
      pageTitle='Facturación Nacional'
      pageDescription='Facturas nacionales (DTE 33/34). Proformas de Materiales listas para facturar y documentos emitidos.'
    >
      <FacturasNacionalListingClient />
    </PageContainer>
  )
}
