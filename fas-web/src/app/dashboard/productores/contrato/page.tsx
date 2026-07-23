import PageContainer from '@/components/layout/page-container'
import { ProductorTabSelectorClient } from '@/features/productores/components/productor-tab-selector-client'

export const metadata = {
  title: 'FAS — Contrato Productor'
}

export default function Page() {
  return (
    <PageContainer
      pageTitle='Contrato'
      pageDescription='Selecciona un productor para ver su contrato.'
    >
      <ProductorTabSelectorClient tab='contrato' />
    </PageContainer>
  )
}
