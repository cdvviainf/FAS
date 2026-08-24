import PageContainer from '@/components/layout/page-container'
import { StockFrutaClient } from '@/features/reportes/stock-fruta/components/stock-fruta-client'

export const metadata = {
  title: 'FAS — Stock de Fruta',
}

export default function Page() {
  return (
    <PageContainer pageTitle='Stock de Fruta'>
      <StockFrutaClient />
    </PageContainer>
  )
}
