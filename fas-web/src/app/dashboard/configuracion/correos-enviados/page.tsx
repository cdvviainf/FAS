import PageContainer from '@/components/layout/page-container'
import { CorreosEnviadosClient } from '@/features/correos-enviados/components/correos-enviados-client'

export const metadata = {
  title: 'FAS — Correos Enviados',
}

export default function Page() {
  return (
    <PageContainer pageTitle='Correos Enviados' pageDescription='Correos enviados por el sistema, uno por destinatario, con su estado y reintento.'>
      <CorreosEnviadosClient />
    </PageContainer>
  )
}
