import PageContainer from '@/components/layout/page-container'
import { ReclamoVentasDetailClient } from '@/features/reclamos/components/reclamo-ventas-detail-client'

export const metadata = {
  title: 'FAS — Reclamo',
}

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function Page(props: PageProps) {
  const params = await props.params
  const id = parseInt(params.id, 10)

  return (
    <PageContainer pageTitle='Reclamo' pageDescription='Provisión y Valorización.'>
      <ReclamoVentasDetailClient id={id} />
    </PageContainer>
  )
}
