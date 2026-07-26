import PageContainer from '@/components/layout/page-container'
import { SolicitudForm } from '@/features/solicitudes-inspeccion/components/solicitud-form'

export const metadata = {
  title: 'FAS — Nueva Solicitud de Inspección',
}

export default function Page() {
  return (
    <PageContainer
      pageTitle='Nueva Solicitud de Inspección'
      pageDescription='Datos de la visita, destino comercial y personas asignadas.'
    >
      <div className='max-w-5xl'>
        <SolicitudForm />
      </div>
    </PageContainer>
  )
}
