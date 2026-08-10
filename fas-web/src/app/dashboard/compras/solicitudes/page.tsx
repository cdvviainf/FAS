import PageContainer from '@/components/layout/page-container'
import { SolicitudListingClient } from '@/features/solicitudes-inspeccion/components/solicitud-listing-client'

export const metadata = {
  title: 'FAS — Solicitud de Inspección',
}

export default function Page() {
  return (
    <PageContainer
      pageTitle='Solicitud de Inspección'
      pageDescription='Gestión de solicitudes de inspección en terreno: ingreso, asignación, notificación y cierre.'
    >
      <SolicitudListingClient contexto='COMPRAS' />
    </PageContainer>
  )
}
