import PageContainer from '@/components/layout/page-container'
import { SolicitudListingClient } from '@/features/solicitudes-inspeccion/components/solicitud-listing-client'

export const metadata = {
  title: 'FAS — Inspección de Compra'
}

export default function Page() {
  return (
    <PageContainer
      pageTitle='Inspección de Compra'
      pageDescription='Solicitudes de inspección de tipo Compra: revisión y cierre. El ingreso, edición y notificación se gestiona desde Compras.'
    >
      <SolicitudListingClient tipoInspeccion='COMPRA' contexto='CALIDAD' />
    </PageContainer>
  )
}
