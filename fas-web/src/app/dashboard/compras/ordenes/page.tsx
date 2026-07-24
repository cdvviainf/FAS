import PageContainer from '@/components/layout/page-container'
import { OrdenCompraListingClient } from '@/features/compras/ordenes-compra/components/orden-compra-listing-client'

export const metadata = {
  title: 'FAS — Órdenes de Compra',
}

export default function Page() {
  return (
    <PageContainer
      pageTitle='Órdenes de Compra'
      pageDescription='Especificación de la compra de fruta a productores, con o sin Cierre Comercial asociado.'
    >
      <OrdenCompraListingClient />
    </PageContainer>
  )
}
