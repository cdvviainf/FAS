import PageContainer from '@/components/layout/page-container'
import { SolicitudPagoForm } from '@/features/productores/solicitudes-pago/components/solicitud-pago-form'

export const metadata = {
  title: 'FAS — Nueva Solicitud de Pago',
}

export default function Page() {
  return (
    <PageContainer pageTitle='Nueva Solicitud de Pago' pageDescription='Selecciona el productor y las cuotas a solicitar.'>
      <div className='max-w-6xl'>
        <SolicitudPagoForm />
      </div>
    </PageContainer>
  )
}
