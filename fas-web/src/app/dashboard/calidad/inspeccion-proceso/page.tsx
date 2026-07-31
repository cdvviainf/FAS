import PageContainer from '@/components/layout/page-container'
import { SolicitudListingClient } from '@/features/solicitudes-inspeccion/components/solicitud-listing-client'

export const metadata = {
  title: 'FAS — Inspección de Proceso'
}

export default function Page() {
  return (
    <PageContainer
      pageTitle='Inspección de Proceso'
      pageDescription='Solicitudes de inspección de tipo Proceso: asignación, notificación y cierre.'
    >
      <SolicitudListingClient tipoInspeccion='PROCESO' />
    </PageContainer>
  )
}
