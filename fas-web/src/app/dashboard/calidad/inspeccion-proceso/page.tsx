import PageContainer from '@/components/layout/page-container'
import { InspeccionProcesoListingClient } from '@/features/compras/instructivo-embalaje/components/inspeccion-proceso-listing-client'

export const metadata = {
  title: 'FAS — Inspección de Proceso'
}

export default function Page() {
  return (
    <PageContainer
      pageTitle='Inspección de Proceso'
      pageDescription='Instructivos de Embalaje: revisión, veredicto y folios. El ingreso y edición se gestiona desde Compras.'
    >
      <InspeccionProcesoListingClient />
    </PageContainer>
  )
}
