import PageContainer from '@/components/layout/page-container'
import { ProformaMaterialListingClient } from '@/features/materiales/proformas-venta/components/proforma-material-listing-client'

export const metadata = {
  title: 'FAS — Proforma de Venta de Materiales',
}

export default function Page() {
  return (
    <PageContainer
      pageTitle='Proforma de Venta de Materiales'
      pageDescription='Venta de materiales a clientes nacionales, generada a partir de un Movimiento de Salida ya confirmado.'
    >
      <ProformaMaterialListingClient />
    </PageContainer>
  )
}
