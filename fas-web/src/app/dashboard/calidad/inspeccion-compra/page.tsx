import PageContainer from '@/components/layout/page-container'
import { SolicitudListingClient } from '@/features/solicitudes-inspeccion/components/solicitud-listing-client'

export const metadata = {
  title: 'FAS — Inspección de Compra'
}

export default function Page() {
  return (
    <PageContainer
      pageTitle='Inspección de Compra'
      pageDescription='Solicitudes de inspección de tipo Compra: asignación, notificación y cierre.'
    >
      <SolicitudListingClient tipoInspeccion='COMPRA' />
    </PageContainer>
  )
}
