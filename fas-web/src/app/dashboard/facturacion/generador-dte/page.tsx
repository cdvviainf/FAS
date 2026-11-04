import PageContainer from '@/components/layout/page-container'
import { GeneradorDteListingClient } from '@/features/facturacion/generador-dte/components/generador-dte-listing-client'

export const metadata = {
  title: 'FAS — Generador DTE',
}

export default function Page() {
  return (
    <PageContainer
      pageTitle='Generador DTE'
      pageDescription='Digitación manual de documentos electrónicos: Factura Nacional, Guía de Despacho, Nota de Crédito y Nota de Débito.'
    >
      <GeneradorDteListingClient />
    </PageContainer>
  )
}
