import PageContainer from '@/components/layout/page-container'
import { RecepcionListingClient } from '@/features/compras/recepciones/components/recepcion-listing-client'

export const metadata = {
  title: 'FAS — Recepción de Stock',
}

export default function Page() {
  return (
    <PageContainer
      pageTitle='Recepción de Stock'
      pageDescription='Carga de fruta real al inventario, con o sin Orden de Compra.'
    >
      <RecepcionListingClient />
    </PageContainer>
  )
}
