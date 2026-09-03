import PageContainer from '@/components/layout/page-container'
import { OrdenCompraMaterialListingClient } from '@/features/materiales/ordenes-compra/components/orden-compra-material-listing-client'

export const metadata = {
  title: 'FAS — Órdenes de Compra de Materiales',
}

export default function Page() {
  return (
    <PageContainer
      pageTitle='Órdenes de Compra de Materiales'
      pageDescription='Compra de materiales e insumos a proveedores.'
    >
      <OrdenCompraMaterialListingClient />
    </PageContainer>
  )
}
