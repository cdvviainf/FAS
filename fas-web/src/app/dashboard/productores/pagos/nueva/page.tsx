import PageContainer from '@/components/layout/page-container'
import { SolicitudPagoForm } from '@/features/productores/solicitudes-pago/components/solicitud-pago-form'

export const metadata = {
  title: 'FAS — Nueva Solicitud de Pago',
}

// Se llega desde "Pendientes de pago" con el productor y las cuotas elegidas.
export default async function Page(props: { searchParams: Promise<{ productor?: string; cuotas?: string }> }) {
  const sp = await props.searchParams
  const productorId = sp.productor && /^\d+$/.test(sp.productor) ? Number(sp.productor) : undefined
  const cuotas = sp.cuotas ? sp.cuotas.split(',').filter(Boolean) : []
  return (
    <PageContainer pageTitle='Nueva Solicitud de Pago' pageDescription='Revisa las cuotas y los montos a solicitar.'>
      <div className='max-w-6xl'>
        <SolicitudPagoForm prefill={productorId ? { productorId, cuotas } : undefined} />
      </div>
    </PageContainer>
  )
}
