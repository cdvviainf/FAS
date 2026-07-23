import PageContainer from '@/components/layout/page-container'
import { SolicitudListingClient } from '@/features/solicitudes-inspeccion/components/solicitud-listing-client'

export const metadata = {
  title: 'FAS — Solicitudes de Inspección'
}

export default function Page() {
  return (
    <PageContainer
      pageTitle='Solicitudes de Inspección'
      pageDescription='Gestión de solicitudes de inspección en terreno: asignación, notificación y cierre.'
    >
      <SolicitudListingClient />
    </PageContainer>
  )
}
