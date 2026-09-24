import PageContainer from '@/components/layout/page-container'
import { ProformaEmbarqueClient } from '@/features/facturacion-exportacion/components/proforma-embarque-client'

export const metadata = {
  title: 'FAS — Proforma',
}

type PageProps = {
  params: Promise<{ embarqueId: string }>
}

export default async function Page(props: PageProps) {
  const params = await props.params
  const embarqueId = parseInt(params.embarqueId, 10)

  return (
    <PageContainer pageTitle='Proforma de Exportación' pageDescription='Emisión de la Proforma del Embarque.'>
      <ProformaEmbarqueClient embarqueId={embarqueId} />
    </PageContainer>
  )
}
