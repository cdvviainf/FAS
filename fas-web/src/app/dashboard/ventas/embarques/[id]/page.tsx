import PageContainer from '@/components/layout/page-container'
import { EmbarqueDetailClient } from '@/features/ventas/embarques/components/embarque-detail-client'

export const metadata = {
  title: 'FAS — Embarque',
}

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function Page(props: PageProps) {
  const params = await props.params
  const id = parseInt(params.id, 10)

  return (
    <PageContainer
      pageTitle='Embarque'
      pageDescription='Solicitud de reserva, instructivo, selección y confirmación de fruta.'
    >
      <EmbarqueDetailClient embarqueId={id} />
    </PageContainer>
  )
}
