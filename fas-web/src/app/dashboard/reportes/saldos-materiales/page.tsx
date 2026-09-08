import PageContainer from '@/components/layout/page-container'
import { SaldosMaterialesClient } from '@/features/reportes/saldos-materiales/components/saldos-materiales-client'

export const metadata = {
  title: 'FAS — Stock de Materiales',
}

export default function Page() {
  return (
    <PageContainer
      pageTitle='Stock de Materiales'
      pageDescription='Saldo actual por artículo y bodega.'
    >
      <SaldosMaterialesClient />
    </PageContainer>
  )
}
