import PageContainer from '@/components/layout/page-container'
import { ReclamosListingClient } from '@/features/reclamos/components/reclamos-listing-client'

export const metadata = {
  title: 'FAS — Reclamos',
}

export default function Page() {
  return (
    <PageContainer
      pageTitle='Reclamos'
      pageDescription='Reclamos de clientes — Provisión y Valorización.'
    >
      <ReclamosListingClient basePath='/dashboard/ventas/reclamos' />
    </PageContainer>
  )
}
