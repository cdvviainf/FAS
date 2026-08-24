import PageContainer from '@/components/layout/page-container'
import { StockFrutaClient } from '@/features/operaciones/stock/components/stock-fruta-client'

export const metadata = {
  title: 'FAS — Stock de Fruta',
}

export default function Page() {
  return (
    <PageContainer
      pageTitle='Stock de Fruta'
      pageDescription='Resumen de pallets recepcionados por especie/variedad/categoría/calibre, con detalle por pallet.'
    >
      <StockFrutaClient />
    </PageContainer>
  )
}
