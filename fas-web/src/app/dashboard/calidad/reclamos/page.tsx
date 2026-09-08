import PageContainer from '@/components/layout/page-container'
import { ReclamosListingClient } from '@/features/reclamos/components/reclamos-listing-client'

export const metadata = {
  title: 'FAS — Reclamos',
}

export default function Page() {
  return (
    <PageContainer
      pageTitle='Reclamos'
      pageDescription='Reclamos de calidad ingresados desde Ventas — análisis, valorización y cierre.'
    >
      <ReclamosListingClient />
    </PageContainer>
  )
}
