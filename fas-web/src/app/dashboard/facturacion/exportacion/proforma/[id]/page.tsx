import PageContainer from '@/components/layout/page-container'
import { ProformaDetalleClient } from '@/features/facturacion-exportacion/components/proforma-detalle-client'

export const metadata = {
  title: 'FAS — Proforma',
}

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function Page(props: PageProps) {
  const params = await props.params
  const id = parseInt(params.id, 10)

  return (
    <PageContainer pageTitle='Proforma de Exportación' pageDescription='Detalle histórico de la Proforma.'>
      <ProformaDetalleClient id={id} />
    </PageContainer>
  )
}
