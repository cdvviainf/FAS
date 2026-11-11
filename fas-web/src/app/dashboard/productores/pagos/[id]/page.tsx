import PageContainer from '@/components/layout/page-container'
import { SolicitudPagoForm } from '@/features/productores/solicitudes-pago/components/solicitud-pago-form'

export const metadata = {
  title: 'FAS — Solicitud de Pago',
}

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function Page(props: PageProps) {
  const params = await props.params
  const id = parseInt(params.id, 10)
  return (
    <PageContainer pageTitle='Solicitud de Pago' pageDescription='Editable mientras esté Solicitada. El pago se confirma con el permiso de tesorería.'>
      <div className='max-w-6xl'>
        <SolicitudPagoForm solicitudId={id} />
      </div>
    </PageContainer>
  )
}
