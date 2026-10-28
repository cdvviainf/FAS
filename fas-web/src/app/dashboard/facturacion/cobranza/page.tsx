import PageContainer from '@/components/layout/page-container'
import { CobranzaClient } from '@/features/facturacion-cobranza/components/cobranza-client'

export const metadata = {
  title: 'FAS — Cobranza',
}

export default function Page() {
  return (
    <PageContainer
      pageTitle='Cobranza'
      pageDescription='Registro de pagos de facturas, cartera por cliente y saldo a favor.'
    >
      <CobranzaClient />
    </PageContainer>
  )
}
