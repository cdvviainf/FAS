import PageContainer from '@/components/layout/page-container'
import { ReclamoDetailClient } from '@/features/reclamos/components/reclamo-detail-client'

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
    <PageContainer pageTitle='Reclamo' pageDescription='Análisis, provisiones, valorización y cierre.'>
      <ReclamoDetailClient id={id} />
    </PageContainer>
  )
}
