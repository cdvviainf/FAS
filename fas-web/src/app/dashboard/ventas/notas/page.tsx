import PageContainer from '@/components/layout/page-container'
import { NotaVentaListingClient } from '@/features/ventas/notas-venta/components/nota-venta-listing-client'

export const metadata = {
  title: 'FAS — Cierre Comercial',
}

export default function Page() {
  return (
    <PageContainer
      pageTitle='Cierre Comercial'
      pageDescription='Notas de Venta: encabezado y detalle de fruta comprometida con el cliente.'
    >
      <NotaVentaListingClient />
    </PageContainer>
  )
}
