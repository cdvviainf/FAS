import PageContainer from '@/components/layout/page-container'
import { EmbarqueListingClient } from '@/features/ventas/embarques/components/embarque-listing-client'

export const metadata = {
  title: 'FAS — Embarques',
}

export default function Page() {
  return (
    <PageContainer
      pageTitle='Embarques'
      pageDescription='Embarques generados desde los Cierres Comerciales.'
    >
      <EmbarqueListingClient />
    </PageContainer>
  )
}
