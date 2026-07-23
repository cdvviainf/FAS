import PageContainer from '@/components/layout/page-container'
import { ProductorTabSelectorClient } from '@/features/productores/components/productor-tab-selector-client'

export const metadata = {
  title: 'FAS — Cuenta Corriente Productor'
}

export default function Page() {
  return (
    <PageContainer
      pageTitle='Cuenta Corriente'
      pageDescription='Selecciona un productor para ver su cuenta corriente.'
    >
      <ProductorTabSelectorClient tab='cuenta-corriente' />
    </PageContainer>
  )
}
