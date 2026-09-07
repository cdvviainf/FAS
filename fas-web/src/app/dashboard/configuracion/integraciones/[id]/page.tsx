import PageContainer from '@/components/layout/page-container'
import { IntegracionDetailClient } from '@/features/integraciones/components/integracion-detail-client'

export const metadata = {
  title: 'FAS — Integración',
}

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function Page(props: PageProps) {
  const params = await props.params
  const id = parseInt(params.id, 10)

  return (
    <PageContainer
      pageTitle='Integración'
      pageDescription='Configuración y parámetros de la integración con el sistema externo.'
    >
      <IntegracionDetailClient id={id} />
    </PageContainer>
  )
}
